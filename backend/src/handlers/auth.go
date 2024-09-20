package handlers

import (
	"UnlockEdv2/src/models"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"slices"
	"strconv"
	"strings"

	log "github.com/sirupsen/logrus"
)

const (
	ClaimsKey         contextKey = "claims"
	KratosBrowserFlow string     = "/self-service/login/browser"
)

type (
	contextKey string
	Claims     struct {
		Username      string          `json:"username"`
		UserID        uint            `json:"user_id"`
		PasswordReset bool            `json:"password_reset"`
		Role          models.UserRole `json:"role"`
		FacilityID    uint            `json:"facility_id"`
		KratosID      string          `json:"kratos_id"`
	}
)

func (srv *Server) registerAuthRoutes() {
	srv.Mux.Handle("POST /api/reset-password", srv.applyMiddleware(srv.handleResetPassword))
	/* only use auth middleware, user activity bloats the database + results */
	srv.Mux.Handle("GET /api/auth", srv.AuthMiddleware(http.HandlerFunc(srv.handleCheckAuth)))
	srv.Mux.Handle("PUT /api/admin/facility-context/{id}", srv.ApplyAdminMiddleware(srv.handleChangeAdminFacility))
}

func (claims *Claims) getTraits() map[string]interface{} {
	return map[string]interface{}{
		"username":       claims.Username,
		"facility_id":    claims.FacilityID,
		"role":           claims.Role,
		"password_reset": claims.PasswordReset,
	}
}

func claimsFromUser(user *models.User) *Claims {
	return &Claims{
		Username:   user.Username,
		UserID:     user.ID,
		Role:       user.Role,
		FacilityID: user.FacilityID,
		KratosID:   user.KratosID,
	}
}

func (s *Server) AuthMiddleware(next http.Handler) http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fields := log.Fields{"handler": "AuthMiddleware"}
		claims, err := s.validateOrySession(r)
		if err != nil {
			log.WithFields(fields).Error("Error validating ory session: ", err)
			s.ErrorResponse(w, http.StatusUnauthorized, "invalid ory session, please clear your cookies")
			return
		}
		ctx := context.WithValue(r.Context(), ClaimsKey, claims)
		if claims.PasswordReset && !isAuthRoute(r) {
			http.Redirect(w, r.WithContext(ctx), "/reset-password", http.StatusOK)
			return
		}
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (srv *Server) handleChangeAdminFacility(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		http.Error(w, "couldn't parse id from path", http.StatusBadRequest)
		return
	}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	claims.FacilityID = uint(id)
	if err := srv.updateUserTraitsInKratos(claims); err != nil {
		http.Error(w, "error updating user traits in kratos", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func isAuthRoute(r *http.Request) bool {
	paths := []string{"/api/login", "/api/logout", "/api/reset-password", "/api/auth", "/api/consent/accept", "/api/facilities/1"}
	return slices.Contains(paths, r.URL.Path)
}

func (srv *Server) UserIsAdmin(r *http.Request) bool {
	claims := r.Context().Value(ClaimsKey).(*Claims)
	return claims.Role == models.Admin
}

func (srv *Server) canViewUserData(r *http.Request) bool {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return false
	}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	return claims.Role == models.Admin || claims.UserID == uint(id)
}

func (srv *Server) adminMiddleware(next func(http.ResponseWriter, *http.Request)) http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := r.Context().Value(ClaimsKey).(*Claims)
		if !ok {
			http.Error(w, "Unauthorized - no claims", http.StatusUnauthorized)
			return
		}
		if claims.Role != models.Admin {
			http.Error(w, "Unauthorized - not admin", http.StatusUnauthorized)
			return
		}
		http.HandlerFunc(next).ServeHTTP(w, r)
	})
}

// Auth endpoint that is called from the client before each <AuthenticatedLayout /> is rendered
func (srv *Server) handleCheckAuth(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "handleCheckAuth"}
	claims, ok := r.Context().Value(ClaimsKey).(*Claims)
	if !ok {
		log.WithFields(fields).Error("No claims found in context")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	fields["user.username"] = claims.Username
	fields["facility_id"] = claims.FacilityID
	user, err := srv.Db.GetUserByID(claims.UserID)
	if err != nil {
		log.WithFields(fields).Error("Error fetching user by ID: ", err)
		srv.ErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	if claims.Role != models.Admin && claims.FacilityID != user.FacilityID {
		// user isn't an admin, and has alternate facility_id in the JWT claims
		fields["claims.facility_id"] = claims.FacilityID
		log.WithFields(fields).Error("user viewing context for different facility. this should never happen")
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	traits := claims.getTraits()
	traits["id"] = user.ID
	traits["kratos_id"] = claims.KratosID
	traits["created_at"] = user.CreatedAt
	traits["name_first"] = user.NameFirst
	traits["name_last"] = user.NameLast
	writeJsonResponse(w, http.StatusOK, traits)
}

// we pull the ory session cookie, and send request to kratos to validate the user session
func (srv *Server) validateOrySession(r *http.Request) (*Claims, error) {
	fields := log.Fields{"handler": "validateOrySession"}
	request, err := http.NewRequest("GET", os.Getenv("KRATOS_PUBLIC_URL")+"/sessions/whoami", nil)
	if err != nil {
		log.WithFields(fields).Error("Error creating request to ory: ", err)
		return nil, err
	}
	cookie := r.Header.Get("Cookie")
	request.Header.Add("Cookie", cookie)
	response, err := srv.Client.Do(request)
	if err != nil {
		log.WithFields(fields).Error("Error sending equest to ory: ", err)
		return nil, err
	}
	if response.StatusCode == 200 {
		oryResp := map[string]interface{}{}
		if err := json.NewDecoder(response.Body).Decode(&oryResp); err != nil {
			log.WithFields(fields).Errorln("error decoding body from ory response")
			return nil, err
		}
		defer response.Body.Close()
		active, ok := oryResp["active"].(bool)
		if !ok {
			log.WithFields(fields).Errorln("error decoding active session from ory response")
			return nil, err
		}
		if active {
			log.WithFields(fields).Info("Got active  session from ory")
			identity, ok := oryResp["identity"].(map[string]interface{})
			if ok {
				kratosID, ok := identity["id"].(string)
				if !ok {
					log.WithFields(fields).Errorln("error parsing ID from ory response")
					return nil, err
				}
				var user models.User
				if err := srv.Db.Find(&user, "kratos_id = ?", kratosID).Error; err != nil {
					fields["error"] = err.Error()
					fields["kratos_id"] = kratosID
					log.WithFields(fields).Errorln("error fetching user found from kratos session")
					return nil, err
				}
				traits := identity["traits"].(map[string]interface{})
				fields["user"] = user
				log.WithFields(fields).Info("found user from ory session")
				claims := &Claims{
					Username:      user.Username,
					UserID:        user.ID,
					FacilityID:    uint(traits["facility_id"].(float64)),
					PasswordReset: traits["password_reset"].(bool),
					KratosID:      kratosID,
					Role:          user.Role,
				}
				return claims, nil
			}
		}
	}
	log.WithFields(fields).Error("Ory session not active")
	return nil, errors.New("ory session not active")
}

type ResetPasswordRequest struct {
	Password     string `json:"password"`
	Confirm      string `json:"confirm"`
	FacilityName string `json:"facility_name"`
}

func (srv *Server) handleResetPassword(w http.ResponseWriter, r *http.Request) {
	log.Info("Handling password reset request", r.URL.Path)
	claims := r.Context().Value(ClaimsKey).(*Claims)
	form := ResetPasswordRequest{}
	if err := json.NewDecoder(r.Body).Decode(&form); err != nil {
		log.Error("Parsing form failed, using JSON" + err.Error())
	}
	defer r.Body.Close()
	if form.Password != form.Confirm {
		http.Error(w, "Passwords do not match", http.StatusBadRequest)
		return
	}
	if !validatePassword(form.Password) {
		http.Error(w, "Password must be at least 8 characters long and contain a number", http.StatusBadRequest)
		return
	}
	tx := srv.Db.Begin()
	user, err := srv.Db.GetUserByID(claims.UserID)
	if err != nil {
		log.Error("Error fetching user by ID: ", err)
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}
	if claims.UserID == 1 && claims.Role == "admin" && form.FacilityName != "" {
		if _, err := srv.Db.UpdateFacility(form.FacilityName, 1); err != nil {
			log.Error("Failed to update facility default name: ", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			tx.Rollback()
			return
		}
	}
	if !srv.isTesting(r) {
		claims := claimsFromUser(user)
		if err := srv.handleUpdatePasswordKratos(claims, form.Password, false); err != nil {
			log.Errorln("Error updating password in kratos: ", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			tx.Rollback()
			return
		}
	}
	if err := tx.Commit().Error; err != nil {
		log.Error("Commit transaction failed: ", err)
		http.Error(w, "Transaction commit failed", http.StatusInternalServerError)
		return
	}
	writeJsonResponse(w, http.StatusOK, "Password reset successfully")
}

func validatePassword(pass string) bool {
	if len(pass) < 8 || !strings.ContainsAny(pass, "12345678910") {
		return false
	}
	return true
}
