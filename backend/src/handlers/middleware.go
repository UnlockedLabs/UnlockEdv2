package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
	log "github.com/sirupsen/logrus"
)

const (
	CsrfTokenCtx csrfTokenKey = "csrf_token"
	timeWindow                = time.Minute
	maxRequests  int          = 50
	// rate limit is 50 requests from a unique user in a minute
)

type csrfTokenKey string

func (srv *Server) setCsrfTokenMiddleware(next http.Handler) http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fields := log.Fields{"handler": "setCsrfTokenMiddleware"}
		bucket := srv.Buckets[CsrfToken]
		checkExists, err := r.Cookie("unlocked_csrf_token")
		if err == nil {
			fields["csrf_token"] = checkExists.Value
			log.WithFields(fields).Traceln("CSRF token already set")
			// now we check if the token is valid
			val, err := bucket.Get(checkExists.Value)
			if err != nil {
				log.WithFields(fields).Traceln("CSRF token is invalid")
				http.Error(w, "Invalid CSRF token", http.StatusForbidden)
				return
			}
			log.WithFields(fields).Traceln("CSRF token is valid")
			ctx := context.WithValue(r.Context(), CsrfTokenCtx, string(val.Value()))
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		} else {
			uniqueId := uuid.NewString()
			http.SetCookie(w, &http.Cookie{
				Name:     "unlocked_csrf_token",
				Value:    uniqueId,
				Expires:  time.Now().Add(24 * time.Hour),
				HttpOnly: true,
				Secure:   true,
				Path:     "/",
			})
			_, err := bucket.Put(uniqueId, []byte(time.Now().Add(24*time.Hour).String()))
			if err != nil {
				log.WithFields(fields).Errorf("Failed to set CSRF token: %v", err)
				http.Error(w, "Failed to set CSRF token", http.StatusInternalServerError)
				return
			}
			ctx := context.WithValue(r.Context(), CsrfTokenCtx, string(uniqueId))
			next.ServeHTTP(w, r.WithContext(ctx))
		}
	})
}

func (srv *Server) rateLimitMiddleware(next http.Handler) http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fields := log.Fields{"handler": "rateLimitMiddleware"}
		kv := srv.Buckets[RateLimit]
		hashedValue, err := getUniqueRequestInfo(r)
		if err != nil {
			log.WithFields(fields).Errorf("Failed to get unique request info: %v", err)
			http.Error(w, "Failed to get unique request info", http.StatusInternalServerError)
			return
		}
		value, err := kv.Get(hashedValue)
		if err != nil {
			// create a new requestInfo
			reqInfo := &requestInfo{
				Count:     1,
				Timestamp: time.Now(),
			}
			if err := putRequestInfo(kv, hashedValue, reqInfo); err != nil {
				log.WithFields(fields).Errorf("Failed to marshal request info: %v", err)
				http.Error(w, "Failed to marshal request info", http.StatusInternalServerError)
				return
			}
			next.ServeHTTP(w, r)
			return
		} else {
			var reqInfo requestInfo
			if err := json.Unmarshal(value.Value(), &reqInfo); err != nil {
				log.WithFields(fields).Errorf("Failed to unmarshal request info: %v", err)
				http.Error(w, "Failed to unmarshal request info", http.StatusInternalServerError)
				return
			}
			if time.Since(reqInfo.Timestamp) > timeWindow {
				reqInfo.Count = 0
				reqInfo.Timestamp = time.Now()
			} else {
				reqInfo.Count++
				if reqInfo.Count > maxRequests {
					http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
					return
				}
			}
			if err := putRequestInfo(kv, hashedValue, &reqInfo); err != nil {
				log.WithFields(fields).Errorf("Failed to marshal request info: %v", err)
				http.Error(w, "Failed to marshal request info", http.StatusInternalServerError)
				return
			}
			next.ServeHTTP(w, r)
			return
		}
	})
}

func putRequestInfo(kv nats.KeyValue, key string, reqInfo *requestInfo) error {
	bytes, err := json.Marshal(reqInfo)
	if err != nil {
		return err
	}
	if _, err := kv.Put(key, bytes); err != nil {
		return err
	}
	return nil
}

type requestInfo struct {
	Count     int       `json:"count"`
	Timestamp time.Time `json:"timestamp"`
}

func getUniqueRequestInfo(r *http.Request) (string, error) {
	csrf, ok := r.Context().Value(CsrfTokenCtx).(string)
	if !ok {
		return "", errors.New("CSRF token not found")
	}
	fwdHost := r.Header.Get("X-Forwarded-For")
	if fwdHost == "" {
		fwdHost = r.RemoteAddr
	}
	unique := r.Header.Get("User-Agent") + fwdHost + csrf
	hashedValue := shaHashValue(unique)
	return hashedValue, nil
}
