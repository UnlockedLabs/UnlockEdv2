package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
)

type contextKey string

const ClaimsKey contextKey = "claims"

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type Claims struct {
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func (s *Server) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("token")
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		token, err := jwt.ParseWithClaims(cookie.Value, &Claims{}, func(token *jwt.Token) (interface{}, error) {
			return []byte("secret"), nil
		})
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		if claims, ok := token.Claims.(*Claims); ok && token.Valid {
			ctx := context.WithValue(r.Context(), ClaimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		} else {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
		}
	})
}

func (s *Server) HandleLogin(w http.ResponseWriter, r *http.Request) {
	s.Logger.Println("Handling login request")
	var form LoginRequest
	err := json.NewDecoder(r.Body).Decode(&form)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if user, err := s.Db.AuthorizeUser(form.Username, form.Password); err == nil {
		claims := Claims{
			Username: user.Username,
			Role:     user.Role,
			RegisteredClaims: jwt.RegisteredClaims{
				Issuer: "admin",
			},
		}
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		signedToken, err := token.SignedString([]byte("secret"))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		http.SetCookie(w, &http.Cookie{
			Name:     "token",
			Value:    signedToken,
			Expires:  time.Now().Add(24 * time.Hour),
			HttpOnly: true,
			Secure:   false, // FIXME: prod
			Path:     "/",
		})
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
		Secure:   false, // FIXME: prod
		Path:     "/",
	})
	w.WriteHeader(http.StatusOK)
}
