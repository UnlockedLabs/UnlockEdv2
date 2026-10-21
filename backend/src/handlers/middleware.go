package handlers

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"net/http"
	"os"
	"slices"
	"strconv"
	"strings"

	"github.com/UnlockedLabs/unlocked-core/backend/src/database"
	"github.com/UnlockedLabs/unlocked-core/backend/src/models"

	log "github.com/sirupsen/logrus"
)

var allowedOrigins []string

func init() {
	corsOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if corsOrigins == "" {
		allowedOrigins = []string{}
	}
	origins := strings.Split(corsOrigins, ",")
	for i, origin := range origins {
		origins[i] = strings.TrimSpace(origin)
	}
	allowedOrigins = origins
}

func (srv *Server) applyMiddleware(h HttpFunc, resolver RouteResolver, accessLevel ...models.FeatureAccess) http.Handler {
	return srv.applyStandardMiddleware(
		srv.checkFeatureAccessMiddleware(
			srv.handleError(h), accessLevel...), resolver)
}

func (srv *Server) applyAdminMiddleware(h HttpFunc, resolver RouteResolver, accessLevel ...models.FeatureAccess) http.Handler {
	return srv.applyStandardMiddleware(
		srv.adminMiddleware(
			srv.checkFeatureAccessMiddleware(
				srv.handleError(h), accessLevel...)), resolver)
}

func (srv *Server) applyStandardMiddleware(next http.Handler, resolver RouteResolver) http.Handler {
	return srv.prometheusMiddleware(
		srv.authMiddleware(
			srv.csrfMiddleware(next), resolver))
}

func corsMiddleware(next http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			if isOriginAllowed(origin) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Length, X-Requested-With")
				w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PATCH, PUT, DELETE")
				w.Header().Set("Vary", "Origin")
			} else {
				log.Warnf("origin is not allowed, origin is: %s", origin)
			}
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
		}
		next.ServeHTTP(w, r)
	}
}

func isOriginAllowed(origin string) bool {
	for _, allowed := range allowedOrigins {
		if origin == allowed {
			return true
		}
	}
	return false
}

func (srv *Server) checkFeatureAccessMiddleware(next http.Handler, accessLevel ...models.FeatureAccess) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := r.Context().Value(ClaimsKey).(*Claims)
		if !ok || !claims.hasFeatureAccess(accessLevel...) {
			// Logged because this 401 was previously invisible: a feature-gated
			// route rejected a resident with no trace anywhere but a prometheus
			// counter, which is exactly the "not enough information in the logs"
			// ID-846 ran into.
			fields := log.Fields{"handler": "checkFeatureAccessMiddleware", "method": r.Method, "path": r.URL.Path, "required_features": accessLevel}
			if ok {
				fields["user_id"] = claims.UserID
				fields["facility_id"] = claims.FacilityID
				fields["feature_access"] = claims.FeatureAccess
			}
			log.WithFields(fields).Warn("feature not enabled for user")
			srv.errorResponse(w, http.StatusUnauthorized, "Feature not enabled")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func generateCSRFToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(b), nil
}

func (srv *Server) ensureCSRFToken(w http.ResponseWriter, r *http.Request) error {
	if _, err := r.Cookie("csrf_token"); err == nil {
		return nil
	}

	token, err := generateCSRFToken()
	if err != nil {
		return err
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "csrf_token",
		Value:    token,
		Path:     "/",
		HttpOnly: false,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   43200,
	})
	return nil
}

func (srv *Server) csrfMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}

		headerToken := r.Header.Get("X-CSRF-Token")
		cookie, err := r.Cookie("csrf_token")

		if err != nil || headerToken == "" {
			srv.errorResponse(w, http.StatusForbidden, "CSRF token missing")
			return
		}

		if subtle.ConstantTimeCompare([]byte(headerToken), []byte(cookie.Value)) != 1 {
			srv.errorResponse(w, http.StatusForbidden, "CSRF token invalid")
			return
		}

		next.ServeHTTP(w, r)
	})
}

type RouteResolver func(*database.DB, *http.Request) bool

// DeptAdminResolver passes department and system admins: the admins who can
// switch facility.
func DeptAdminResolver(_ *database.DB, r *http.Request) bool {
	return r.Context().Value(ClaimsKey).(*Claims).canSwitchFacility()
}

// SystemAdminResolver passes system admins only.
func SystemAdminResolver(_ *database.DB, r *http.Request) bool {
	return r.Context().Value(ClaimsKey).(*Claims).Role == models.SystemAdmin
}

// resolver where there is a direct relationship between the resource and the facility_id
// arguments are "table_name", "path_parameter_name"
func FacilityAdminResolver(table string, param string) RouteResolver {
	return func(tx *database.DB, r *http.Request) bool {
		claims := r.Context().Value(ClaimsKey).(*Claims)
		if claims.canSwitchFacility() {
			return true
		}
		id := r.PathValue(param)
		// The facilities table IS the facility — compare path ID directly.
		if table == "facilities" {
			facID, err := strconv.ParseUint(id, 10, 64)
			return err == nil && claims.FacilityID == uint(facID)
		}
		var facID uint
		columnName := "facility_id"
		if table == "facilities" {
			columnName = "id"
		}
		err := tx.Table(table).
			Select(columnName).
			Where("id = ?", id).
			Limit(1).Scan(&facID).Error
		return err == nil && claims.FacilityID == facID
	}
}

func UserRoleResolver(routeId string) RouteResolver {
	return func(tx *database.DB, r *http.Request) bool {
		claims := r.Context().Value(ClaimsKey).(*Claims)
		if claims.canSwitchFacility() {
			// system or dept admin can see all data
			return true
		}
		id, err := strconv.Atoi(r.PathValue(routeId))
		if err != nil {
			return false
		}
		if claims.UserID == uint(id) {
			// it's the user referenced in the path
			return true
		}
		if !slices.Contains(models.AdminRoles, claims.Role) {
			// if not the specific user and not an admin:
			return false
		}
		user, err := tx.GetUserByID(uint(id))
		// facility admin, needs to be from the facility of the referenced user
		return err == nil && user.FacilityID == claims.FacilityID
	}
}

func ResidentFeatureResolver(feature models.FeatureAccess) RouteResolver {
	return func(tx *database.DB, r *http.Request) bool {
		claims, ok := r.Context().Value(ClaimsKey).(*Claims)
		if !ok {
			return false
		}
		if slices.Contains(models.AdminRoles, claims.Role) {
			return true
		}
		return claims.hasFeatureAccess(feature)
	}
}

// AllResolvers passes only when every resolver passes, for routes that need more than one check.
func AllResolvers(resolvers ...RouteResolver) RouteResolver {
	return func(tx *database.DB, r *http.Request) bool {
		for _, resolve := range resolvers {
			if !resolve(tx, r) {
				return false
			}
		}
		return true
	}
}
