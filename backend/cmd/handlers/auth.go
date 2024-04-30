package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
)

type contextKey string

const ClaimsKey contextKey = "claims"

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type ResetPasswordRequest struct {
	Password string `json:"password"`
	Confirm  string `json:"confirm"`
}

type Claims struct {
	UserID        int    `json:"user_id"`
	PasswordReset bool   `json:"password_reset"`
	Role          string `json:"role"`
	jwt.RegisteredClaims
}

func (srv *Server) RegisterAuthRoutes() {
	srv.Mux.Handle("/api/login", http.HandlerFunc(srv.HandleLogin))
	srv.Mux.Handle("/api/logout", srv.ApplyMiddleware(http.HandlerFunc(srv.HandleLogout)))
	srv.Mux.Handle("/api/reset-password", srv.ApplyMiddleware(http.HandlerFunc(srv.HandleResetPassword)))
}

func (s *Server) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("token")
		if err != nil {
			s.LogError("No token found " + err.Error())
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
			if claims.PasswordReset && r.URL.Path != "/api/reset-password" {
				http.ServeFile(w, r.WithContext(ctx), "frontend/public/password_reset.html")
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		} else {
			log.Println("Invalid claims")
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
		}
	})
}

func (srv *Server) UserIsAdmin(r *http.Request) bool {
	claims := r.Context().Value(ClaimsKey).(*Claims)
	return claims.Role == "admin"
}

func (srv *Server) UserIsOwner(r *http.Request) bool {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return false
	}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	return claims.UserID == id
}

func (srv *Server) AdminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := r.Context().Value(ClaimsKey).(*Claims)
		if claims.Role != "admin" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r.WithContext(r.Context()))
	})
}

func (s *Server) HandleLogin(w http.ResponseWriter, r *http.Request) {
	s.LogInfo("Handling login request")
	var form LoginRequest
	err := json.NewDecoder(r.Body).Decode(&form)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if user, err := s.Db.AuthorizeUser(form.Username, form.Password); err == nil {
		claims := Claims{
			UserID:        user.ID,
			PasswordReset: user.PasswordReset,
			Role:          string(user.Role),
			RegisteredClaims: jwt.RegisteredClaims{
				Issuer: "admin",
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
			HttpOnly: true,
			Secure:   false,
			Path:     "/",
		})
		if user.PasswordReset {
			http.ServeFile(w, r.WithContext(r.Context()), "frontend/public/password_reset.html")
		}
		_, err = w.Write([]byte("Logged in successfully!"))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	} else {
		http.Error(w, "Invalid username or password", http.StatusUnauthorized)
	}
}

func (s *Server) HandleLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    "",
		Expires:  time.Now().Add(-1 * time.Hour),
		HttpOnly: true,
		Secure:   false,
		Path:     "/",
	})
	w.WriteHeader(http.StatusOK)
}

func (srv *Server) HandleResetPassword(w http.ResponseWriter, r *http.Request) {
	srv.LogInfo("Handling password reset request")
	claims := r.Context().Value(ClaimsKey).(*Claims)
	password, confirm := "", ""
	err := r.ParseForm()
	if err != nil {
		srv.LogError("Parsing form failed")
	}
	password = r.PostFormValue("password")
	confirm = r.PostFormValue("confirm")
	if password == "" || confirm == "" {
		form := ResetPasswordRequest{}
		if err := json.NewDecoder(r.Body).Decode(&form); err != nil {
			srv.LogError("Parsing form failed, using JSON" + err.Error())
		}
		password = form.Password
		confirm = form.Confirm
	}
	if password != confirm || !ValidatePassword(password) {
		http.ServeFile(w, r.WithContext(r.Context()), "frontend/public/error.html")
		srv.LogError("Password validation failed")
		return
	}
	if err := srv.Db.ResetUserPassword(claims.UserID, password); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		srv.LogError("Error Resetting users password: " + err.Error())
		return
	}
	if err = srv.WriteResponse(w, http.StatusOK, "Password reset successfully"); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		srv.LogError("Error writing response: " + err.Error())
		return
	}
}

func ValidatePassword(pass string) bool {
	if len(pass) < 8 || !strings.ContainsAny(pass, "12345678910") {
		return false
	}
	return true
}
