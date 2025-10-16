package handlers

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"context"
	"encoding/json"
	"net/http"
	"os"
	"regexp"
	"slices"
	"strconv"
	"strings"

	log "github.com/sirupsen/logrus"
)

const (
	libraryKey contextKey = "library"
	videoKey   contextKey = "video"
	// rate limit is 50 requests from a unique user in a minute
)

// regular expression used below for filtering open_content_urls
var resourceRegExpression = regexp.MustCompile(`\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|ttf|map|webp|otf|vtt|webm|json|woff2|pdf)(\?|%3F|$)`)

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
			next, resolver))
}

func (srv *Server) videoProxyMiddleware(next http.Handler) http.Handler {
	return srv.applyStandardMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := r.Context().Value(ClaimsKey).(*Claims)
		if !srv.hasFeatureAccess(models.OpenContentAccess) {
			http.Redirect(w, r, AuthCallbackRoute, http.StatusSeeOther)
			return
		}
		resourceID := r.PathValue("id")
		var video models.Video

		tx := srv.Db.Model(&models.Video{}).
			Select(`videos.*,
            (CASE WHEN fvs.visibility_status IS NULL THEN false ELSE fvs.visibility_status END) AS visibility_status`).
			Joins(`LEFT OUTER JOIN facility_visibility_statuses fvs
            ON fvs.open_content_provider_id = videos.open_content_provider_id
            AND fvs.content_id = videos.id
            AND fvs.facility_id = ?`, user.FacilityID).
			Where("videos.id = ?", resourceID)
		if user.isAdmin() {
			tx = tx.First(&video)
		} else {
			tx = tx.First(&video, "fvs.visibility_status = true AND availability = 'available'")
		}
		if err := tx.Error; err != nil {
			srv.errorResponse(w, http.StatusNotFound, "Video not found, is not available or visibility is not enabled")
			return
		}
		ctx := context.WithValue(r.Context(), videoKey, &video)
		next.ServeHTTP(w, r.WithContext(ctx))
	}), nil)
}

func (srv *Server) libraryProxyMiddleware(next http.Handler) http.Handler {
	return srv.applyStandardMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := r.Context().Value(ClaimsKey).(*Claims)
		if !srv.hasFeatureAccess(models.OpenContentAccess) {
			http.Redirect(w, r, AuthCallbackRoute, http.StatusSeeOther)
			return
		}
		libraryBucket := srv.buckets[LibraryPaths]
		resourceID := r.PathValue("id")
		entry, err := libraryBucket.Get(resourceID)
		var proxyParams *models.LibraryProxyPO
		if err == nil { //found in bucket going to use cached slice of bytes
			err = json.Unmarshal(entry.Value(), &proxyParams)
			if err != nil {
				log.Warnf("issue unmarshaling LibraryProxyPO from nats bucket, error is: %v", err)
			}
		}
		var library models.Library
		if err != nil {
			query := srv.Db.Model(&models.Library{}).Preload("OpenContentProvider").
				Select("libraries.*, fvs.visibility_status").
				Joins(`left outer join facility_visibility_statuses fvs on fvs.open_content_provider_id = libraries.open_content_provider_id
					and fvs.content_id = libraries.id
					and fvs.facility_id = ?`, user.FacilityID)
			if query.First(&library, "id = ?", resourceID).RowsAffected == 0 {
				srv.errorResponse(w, http.StatusNotFound, "Library not found.")
				return
			}
			proxyParams = library.IntoProxyPO()
			marshaledParams, marshErr := json.Marshal(proxyParams)
			if marshErr != nil {
				log.Warnf("issue marshaling LibraryProxyPO, error is: %v", marshErr)
			}
			if marshErr != nil {
				if _, err := libraryBucket.Put(resourceID, marshaledParams); err != nil {
					log.Warnf("issue putting LibraryProxyPO into bucket, error is: %v", err)
				}
			}
		}
		if !user.isAdmin() && !proxyParams.VisibilityStatus {
			srv.errorResponse(w, http.StatusNotFound, "Visibility is not enabled")
			return
		}
		urlString := r.URL.String()
		if !resourceRegExpression.MatchString(urlString) && !strings.Contains(urlString, "iframe") {
			activity := models.OpenContentActivity{
				OpenContentProviderID: proxyParams.OpenContentProviderID,
				FacilityID:            user.FacilityID,
				UserID:                user.UserID,
				ContentID:             proxyParams.ID,
			}
			if !user.isAdmin() {
				srv.createContentActivityAndNotifyWS(urlString, &activity)
			}
		}
		ctx := context.WithValue(r.Context(), libraryKey, proxyParams)
		next.ServeHTTP(w, r.WithContext(ctx))
	}), nil)
}

func corsMiddleware(next http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		if origin != "" {
			allowedOrigins := getAllowedOrigins()
			if isOriginAllowed(origin, allowedOrigins) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Length, X-Requested-With")
				w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PATCH, PUT, DELETE")
				w.Header().Set("Vary", "Origin")
			}else{
				log.Warnf("origin is not allowed, origin is: %v", origin)
			}
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
		}
		next.ServeHTTP(w, r)
	}
}

func getAllowedOrigins() []string {
	corsOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if corsOrigins == "" {
		return []string{}
	}
	origins := strings.Split(corsOrigins, ",")
	for i, origin := range origins {
		origins[i] = strings.TrimSpace(origin)
	}
	return origins
}

func isOriginAllowed(origin string, allowedOrigins []string) bool {
	for _, allowed := range allowedOrigins {
		if origin == allowed {
			return true
		}
	}
	return false
}

func (srv *Server) checkFeatureAccessMiddleware(next http.Handler, accessLevel ...models.FeatureAccess) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !srv.hasFeatureAccess(accessLevel...) {
			srv.errorResponse(w, http.StatusUnauthorized, "Feature not enabled")
			return
		}
		next.ServeHTTP(w, r)
	})
}

type RouteResolver func(*database.DB, *http.Request) bool

// resolver where there is a direct relationship between the resource and the facility_id
// arguments are "table_name", "path_parameter_name"
func FacilityAdminResolver(table string, param string) RouteResolver {
	return func(tx *database.DB, r *http.Request) bool {
		claims := r.Context().Value(ClaimsKey).(*Claims)
		if claims.canSwitchFacility() {
			return true
		}
		id := r.PathValue(param)
		var facID uint
		err := tx.Table(table).
			Select("facility_id").
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
