package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"slices"
	"strconv"
	"strings"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
	log "github.com/sirupsen/logrus"
)

type contextKey string

const ClaimsKey contextKey = "claims"

type LoginRequest struct {
	Username       string `json:"username"`
	Password       string `json:"password"`
	LoginChallenge string `json:"login_challenge"`
}

type ResetPasswordRequest struct {
	Password string `json:"password"`
	Confirm  string `json:"confirm"`
}

type Claims struct {
	UserID        uint   `json:"user_id"`
	PasswordReset bool   `json:"password_reset"`
	Role          string `json:"role"`
	jwt.RegisteredClaims
}

func (srv *Server) registerAuthRoutes() {
	srv.Mux.Handle("POST /api/login", http.HandlerFunc(srv.handleLogin))
	srv.Mux.Handle("POST /api/logout", srv.applyMiddleware(http.HandlerFunc(srv.handleLogout)))
	srv.Mux.Handle("POST /api/reset-password", srv.applyMiddleware(http.HandlerFunc(srv.handleResetPassword)))
	/* only use auth middleware, user activity bloats the database + results */
	srv.Mux.Handle("GET /api/auth", srv.AuthMiddleware(http.HandlerFunc(srv.handleCheckAuth)))
}

func (s *Server) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("token")
		if err != nil {
			log.Error("No token found " + err.Error())
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		token, err := jwt.ParseWithClaims(cookie.Value, &Claims{}, func(token *jwt.Token) (interface{}, error) {
			return []byte(os.Getenv("JWT_SECRET")), nil
		})
		if err != nil {
			log.Println("Invalid token")
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		if claims, ok := token.Claims.(*Claims); ok && token.Valid {
			ctx := context.WithValue(r.Context(), ClaimsKey, claims)
			if claims.PasswordReset && !isAuthRoute(r) {
				http.Redirect(w, r.WithContext(ctx), "/reset-password", http.StatusOK)
				return
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		} else {
			log.Println("Invalid claims")
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
		}
	})
}

func isAuthRoute(r *http.Request) bool {
	paths := []string{"/api/login", "/api/logout", "/api/reset-password", "/api/auth", "/api/consent/accept"}
	return slices.Contains(paths, r.URL.Path)
}

func (srv *Server) UserIsAdmin(r *http.Request) bool {
	claims := r.Context().Value(ClaimsKey).(*Claims)
	return claims.Role == "admin"
}

func (srv *Server) canViewUserData(r *http.Request) bool {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return false
	}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	return claims.Role == "admin" || claims.UserID == uint(id)
}

func (srv *Server) UserIsOwner(r *http.Request) bool {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return false
	}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	return claims.UserID == uint(id)
}

func (srv *Server) adminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := r.Context().Value(ClaimsKey).(*Claims)
		if claims.Role != "admin" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r.WithContext(r.Context()))
	})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var form LoginRequest
	err := json.NewDecoder(r.Body).Decode(&form)
	defer r.Body.Close()
	if err != nil {
		log.Error("Parsing form failed, using urlform" + err.Error())
	}
	if user, err := s.Db.AuthorizeUser(form.Username, form.Password); err == nil {
		claims := Claims{
			UserID:        user.ID,
			PasswordReset: user.PasswordReset,
			Role:          string(user.Role),
			RegisteredClaims: jwt.RegisteredClaims{
				Issuer:  "admin",
				Subject: user.Username,
			},
		}
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		signedToken, err := token.SignedString([]byte(os.Getenv("APP_KEY")))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		http.SetCookie(w, &http.Cookie{
			Name:     "token",
			Value:    signedToken,
			Expires:  time.Now().Add(24 * time.Hour),
			SameSite: http.SameSiteDefaultMode,
			HttpOnly: true,
			Secure:   true,
			Path:     "/",
		})
		if form.LoginChallenge != "" {
			s.handleOidcLogin(w, r.WithContext(r.Context()), claims, form.LoginChallenge)
			return
		}
		err = s.WriteResponse(w, http.StatusOK, user)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	} else {
		http.Error(w, "Invalid username or password", http.StatusUnauthorized)
		return
	}
}

func (srv *Server) logoutCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    "",
		Expires:  time.Now().Add(-1 * time.Hour),
		SameSite: http.SameSiteNoneMode,
		HttpOnly: true,
		Secure:   true,
		Path:     "/",
	})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	s.logoutCookie(w)
	w.WriteHeader(http.StatusOK)
}

func (srv *Server) handleCheckAuth(w http.ResponseWriter, r *http.Request) {
	log.Info("Checking auth handler")
	claims := r.Context().Value(ClaimsKey).(*Claims)
	user := srv.Db.GetUserByID(claims.UserID)
	if user == nil {
		log.Error("Error getting user by ID")
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}
	if err := srv.WriteResponse(w, http.StatusOK, user); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		log.Error("Error writing response: " + err.Error())
	}
}

func (srv *Server) handleResetPassword(w http.ResponseWriter, r *http.Request) {
	log.Info("Handling password reset request", r.URL.Path)
	claims := r.Context().Value(ClaimsKey).(*Claims)
	password, confirm := "", ""
	err := r.ParseForm()
	if err != nil {
		log.Error("Parsing form failed")
	}
	password = r.PostFormValue("password")
	confirm = r.PostFormValue("confirm")
	if password == "" || confirm == "" {
		form := ResetPasswordRequest{}
		if err := json.NewDecoder(r.Body).Decode(&form); err != nil {
			log.Error("Parsing form failed, using JSON" + err.Error())
		}
		password = form.Password
		confirm = form.Confirm
	}
	defer r.Body.Close()
	if password != confirm {
		http.Error(w, "Passwords do not match", http.StatusBadRequest)
		return
	}
	if !validatePassword(password) {
		http.Error(w, "Password must be at least 8 characters long and contain a number", http.StatusBadRequest)
		return
	}
	if err := srv.Db.ResetUserPassword(claims.UserID, password); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Error("Error Resetting users password: " + err.Error())
		return
	}
	claims.PasswordReset = false
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString([]byte(os.Getenv("APP_KEY")))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    signedToken,
		Expires:  time.Now().Add(24 * time.Hour),
		HttpOnly: true,
		Secure:   true,
		Path:     "/",
	})
	if err = srv.WriteResponse(w, http.StatusOK, "Password reset successfully"); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		log.Error("Error writing response: " + err.Error())
		return
	}
}

func validatePassword(pass string) bool {
	if len(pass) < 8 || !strings.ContainsAny(pass, "12345678910") {
		return false
	}
	return true
}
