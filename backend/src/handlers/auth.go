package handlers

import (
	"UnlockEdv2/src/models"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"slices"
	"strings"
	"time"

	log "github.com/sirupsen/logrus"
)

const (
	ClaimsKey         contextKey = "claims"
	KratosBrowserFlow string     = "/self-service/login/browser"
	AuthCallbackRoute string     = "/authcallback"
)

type (
	contextKey string
	Claims     struct {
		Username      string                 `json:"username"`
		Email         string                 `json:"email"`
		UserID        uint                   `json:"user_id"`
		PasswordReset bool                   `json:"password_reset"`
		Role          models.UserRole        `json:"role"`
		FacilityID    uint                   `json:"facility_id"`
		FacilityName  string                 `json:"facility_name"`
		KratosID      string                 `json:"kratos_id"`
		FeatureAccess []models.FeatureAccess `json:"feature_access"`
		SessionID     string                 `json:"session_id"`
		DocID         string                 `json:"doc_id"`
		TimeZone      string                 `json:"timezone"`
	}
)

func (c *Claims) canSwitchFacility() bool {
	return slices.Contains([]models.UserRole{models.SystemAdmin, models.DepartmentAdmin}, c.Role)
}

func (srv *Server) registerAuthRoutes() []routeDef {
	return []routeDef{
		newRoute("POST /api/reset-password", srv.handleResetPassword),
		newRoute("GET /api/auth", srv.handleCheckAuth),
		/* only use auth middleware, user activity bloats the database + results */
	}
}

func (claims *Claims) getTraits() map[string]any {
	return map[string]any{
		"username":       claims.Username,
		"email":          claims.Email,
		"facility_id":    claims.FacilityID,
		"role":           claims.Role,
		"password_reset": claims.PasswordReset,
		"facility_name":  claims.FacilityName,
		"feature_access": claims.FeatureAccess,
		"doc_id":         claims.DocID,
		"timezone":       claims.TimeZone,
	}
}

func (claims *Claims) isAdmin() bool {
	return slices.Contains(models.AdminRoles, claims.Role)
}

func claimsFromUser(user *models.User) *Claims {
	return &Claims{
		Username:   user.Username,
		UserID:     user.ID,
		Role:       user.Role,
		FacilityID: user.FacilityID,
		KratosID:   user.KratosID,
		Email:      user.Email,
	}
}

func (s *Server) authMiddleware(next http.Handler, resolver RouteResolver) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fields := log.Fields{"handler": "authMiddleware"}
		var claims *Claims

		if s.testingMode {
			if testClaimsJSON := r.Header.Get("X-Test-Claims"); testClaimsJSON != "" {
				var testClaims Claims
				if err := json.Unmarshal([]byte(testClaimsJSON), &testClaims); err == nil {
					claims = &testClaims
				}
			}
		}

		if claims == nil {
			var hasCookie bool
			var err error
			claims, hasCookie, err = s.validateOrySession(r)
			if err != nil {
				if hasCookie {
					s.clearKratosCookies(w, r)
				}
				log.WithFields(fields).Error("Error validating ory session: ", err)
				s.errorResponse(w, http.StatusUnauthorized, "invalid ory session, please clear your cookies")
				return
			}
		}

		ctx := context.WithValue(r.Context(), ClaimsKey, claims)

		if claims.PasswordReset && !isAuthRoute(r) {
			http.Redirect(w, r.WithContext(ctx), "/reset-password", http.StatusOK)
			return
		}

		// Call to named or custom resolver by routedef
		if resolver != nil {
			if !resolver(s.Db, r.WithContext(ctx)) {
				http.Error(w, "User is not allowed to view this resource", http.StatusUnauthorized)
				return
			}
		}

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s *Server) clearKratosCookies(w http.ResponseWriter, r *http.Request) {
	cookies := r.Cookies()
	for _, cookie := range cookies {
		http.SetCookie(w, &http.Cookie{
			Name:    cookie.Name,
			Value:   "",
			Expires: time.Now().Add(-1 * time.Hour),
			Path:    "/",
		})
	}
}

func isAuthRoute(r *http.Request) bool {
	paths := []string{"/api/login", "/api/logout", "/api/reset-password", "/api/auth", "/api/consent/accept", "/api/facilities/1"}
	return slices.Contains(paths, r.URL.Path)
}

func userIsAdmin(r *http.Request) bool {
	claims := r.Context().Value(ClaimsKey).(*Claims)
	return claims.isAdmin()
}

func userIsSystemAdmin(r *http.Request) bool {
	return r.Context().Value(ClaimsKey).(*Claims).Role == models.SystemAdmin
}

func (srv *Server) adminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := r.Context().Value(ClaimsKey).(*Claims)
		if !ok {
			srv.errorResponse(w, http.StatusUnauthorized, "Unauthorized - no claims")
			return
		}
		if !claims.isAdmin() {
			srv.errorResponse(w, http.StatusUnauthorized, "Unauthorized - not admin")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Auth endpoint that is called from the client before each <AuthenticatedLayout /> is rendered
func (srv *Server) handleCheckAuth(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims, ok := r.Context().Value(ClaimsKey).(*Claims)
	if !ok {
		log.error("No claims found in context")
		return newUnauthorizedServiceError()
	}
	log.add("username", claims.Username)
	log.add("facility_id", claims.FacilityID)
	user, err := srv.Db.GetUserByID(claims.UserID)
	if err != nil { //special case here, kept original flow as Unauthorized is referenced in api.ts file)
		return NewServiceError(err, http.StatusUnauthorized, "Unauthorized")
	}
	traits := claims.getTraits()
	if claims.canSwitchFacility() {
		// if the user can see all the facilities, preload them in the claims so we
		// aren't fetching them repeatedly in every other route loader.
		if _, facilities, err := srv.Db.GetAllFacilities(1, 100); err == nil {
			traits["facilities"] = facilities
		}
	} else if !claims.canSwitchFacility() && claims.FacilityID != user.FacilityID {
		// user isn't an admin, and has alternate facility_id in the claims
		log.error("user viewing context for different facility. this should never happen")
		return newUnauthorizedServiceError()
	}
	traits["id"] = user.ID
	traits["session_id"] = claims.SessionID
	traits["kratos_id"] = claims.KratosID
	traits["created_at"] = user.CreatedAt
	traits["name_first"] = user.NameFirst
	traits["name_last"] = user.NameLast
	traits["timezone"] = claims.TimeZone
	if traits["feature_access"] == nil || len(srv.features) == 0 {
		traits["feature_access"] = []models.FeatureAccess{}
	}
	return writeJsonResponse(w, http.StatusOK, traits)
}

// we pull the ory session cookie, and send request to kratos to validate the user session
func (srv *Server) validateOrySession(r *http.Request) (*Claims, bool, error) {
	fields := log.Fields{"handler": "validateOrySession"}
	request, err := http.NewRequest("GET", os.Getenv("KRATOS_PUBLIC_URL")+"/sessions/whoami", nil)
	if err != nil {
		log.WithFields(fields).Error("Error creating request to ory: ", err)
		return nil, false, err
	}
	var hasCookie bool
	cookie := r.Header.Get("Cookie")
	if strings.Contains(cookie, "ory_kratos_session") {
		hasCookie = true
	}
	request.Header.Add("Cookie", cookie)
	response, err := srv.Client.Do(request)
	if err != nil {
		log.WithFields(fields).Error("Error sending equest to ory: ", err)
		return nil, hasCookie, err
	}
	if response.StatusCode == 200 {
		oryResp := map[string]any{}
		if err := json.NewDecoder(response.Body).Decode(&oryResp); err != nil {
			log.WithFields(fields).Errorln("error decoding body from ory response")
			return nil, hasCookie, err
		}
		defer func() {
			if response.Body.Close() != nil {
				log.WithFields(fields).Errorln("error closing body from ory response")
			}
		}()
		active, ok := oryResp["active"].(bool)
		if !ok {
			log.WithFields(fields).Errorln("error decoding active session from ory response")
			return nil, hasCookie, err
		}
		sessionID, ok := oryResp["id"].(string)
		if !ok {
			return nil, hasCookie, errors.New("ory session ID not found")
		}
		if active {
			identity, ok := oryResp["identity"].(map[string]any)
			if ok {
				kratosID, ok := identity["id"].(string)
				if !ok {
					log.WithFields(fields).Errorln("error parsing ID from ory response")
					return nil, hasCookie, err
				}
				var user models.User
				if err := srv.Db.Model(&models.User{}).Preload("Facility").Find(&user, "kratos_id = ?", kratosID).Error; err != nil {
					fields["error"] = err.Error()
					fields["kratos_id"] = kratosID
					log.WithFields(fields).Errorln("error fetching user found from kratos session")
					return nil, hasCookie, err
				}
				if user.DeactivatedAt != nil {
					log.Error("User is deactivated, cannot access auth endpoint")
					return &Claims{}, false, newBadRequestServiceError(errors.New("account deactivated"), "Account deactivated. Contact the facility administrator for support.")
				}
				traits := identity["traits"].(map[string]any)
				fields["user"] = user
				log.WithFields(fields).Trace("found user from ory session")
				facilityId, ok := traits["facility_id"].(float64)
				if !ok {
					facilityId = float64(user.FacilityID)
				}
				if uint(facilityId) != user.FacilityID && !slices.Contains([]models.UserRole{models.DepartmentAdmin, models.SystemAdmin}, user.Role) {
					return nil, hasCookie, errors.New("user is not allowed to switch facilities")
				}

				passReset, ok := traits["password_reset"].(bool)
				if !ok {
					passReset = true
				}
				facilityName := user.Facility.Name
				tz := user.Facility.Timezone
				if user.FacilityID != uint(facilityId) && slices.Contains([]models.UserRole{models.DepartmentAdmin, models.SystemAdmin}, user.Role) {
					var nameTz struct {
						Name     string `json:"name"`
						Timezone string `json:"timezone"`
					}
					if err := srv.Db.Model(&models.Facility{}).
						Select("name, timezone").
						Where("id = ?", facilityId).
						Find(&nameTz).Error; err != nil {
						return nil, hasCookie, err
					}
					facilityName = nameTz.Name
					tz = nameTz.Timezone
				}
				claims := &Claims{
					Username:      user.Username,
					Email:         user.Email,
					UserID:        user.ID,
					FacilityID:    uint(facilityId),
					FacilityName:  facilityName,
					PasswordReset: passReset,
					KratosID:      kratosID,
					Role:          user.Role,
					FeatureAccess: srv.features,
					SessionID:     sessionID,
					TimeZone:      tz,
				}
				if string(user.Role) != traits["role"].(string) {
					err := srv.updateUserTraitsInKratos(claims)
					if err != nil {
						log.WithFields(fields).Errorf("Error updating user traits in kratos: %v", err)
					}
				}
				return claims, hasCookie, nil
			}
		}
	}
	log.WithFields(fields).Error("Ory session not active")
	return nil, hasCookie, errors.New("ory session not active")
}

type ResetPasswordRequest struct {
	Password     string `json:"password"`
	Confirm      string `json:"confirm"`
	FacilityName string `json:"facility_name"`
	Timezone     string `json:"timezone"`
}

func (srv *Server) handleResetPassword(w http.ResponseWriter, r *http.Request, log sLog) error {
	log.info("Handling password reset request", r.URL.Path)
	claims := r.Context().Value(ClaimsKey).(*Claims)
	form := ResetPasswordRequest{}
	if err := json.NewDecoder(r.Body).Decode(&form); err != nil {
		log.error("Parsing form failed, using JSON" + err.Error())
	}
	if form.Password != form.Confirm {
		return newBadRequestServiceError(errors.New("passwords do not match"), "passwords do not match")
	}
	if !validatePassword(form.Password) {
		return newBadRequestServiceError(errors.New("password not formatted correclty"), "Password must be at least 8 characters long and contain a number")
	}
	tx := srv.Db.Begin()
	user, err := srv.Db.GetUserByID(claims.UserID)
	log.add("user_id", claims.UserID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	log.add("username_to_reset", user.Username)
	if claims.Role == models.SystemAdmin && form.FacilityName != "" {
		facility := models.Facility{Name: form.FacilityName, Timezone: form.Timezone}
		if err := srv.Db.UpdateFacility(&facility, 1); err != nil {
			tx.Rollback()
			return newDatabaseServiceError(err)
		}
	}
	claims = claimsFromUser(user)
	if err := srv.handleUpdatePasswordKratos(claims, form.Password, false); err != nil {
		tx.Rollback()
		return newInternalServerServiceError(err, "error updating password in kratos")
	}
	if err := tx.Commit().Error; err != nil {
		return newInternalServerServiceError(err, "Transaction commit failed")
	}
	resp := map[string]string{}
	resp["redirect_to"] = AuthCallbackRoute
	setPassword := models.NewUserAccountHistory(claims.UserID, models.SetPassword, nil, nil, nil)
	if err := srv.Db.InsertUserAccountHistoryAction(r.Context(), setPassword); err != nil {
		return newCreateRequestServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, resp)
}

func validatePassword(pass string) bool {
	if len(pass) < 8 || !strings.ContainsAny(pass, "12345678910") {
		return false
	}
	return true
}
