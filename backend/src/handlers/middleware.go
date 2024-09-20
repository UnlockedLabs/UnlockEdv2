package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
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

func (srv *Server) setCsrfTokenMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fields := log.Fields{"handler": "setCsrfTokenMiddleware"}
		bucket := srv.buckets[CsrfToken]
		checkExists, err := r.Cookie("unlocked_csrf_token")
		if err == nil {
			fields["csrf_token"] = checkExists.Value
			// now we check if the token is validjA
			val, err := bucket.Get(checkExists.Value)
			if err != nil {
				srv.clearKratosCookies(w, r)
				if !isAuthRoute(r) {
					http.Redirect(w, r, fmt.Sprintf("%s/browser?return_to=%s", LoginEndpoint, r.URL.Path), http.StatusSeeOther)
					log.WithFields(fields).Traceln("CSRF token is invalid, redirecting user")
					return
				}
			}
			log.WithFields(fields).Traceln("CSRF token is valid")
			ctx := context.WithValue(r.Context(), CsrfTokenCtx, string(val.Value()))
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}
		uniqueId := uuid.NewString()
		http.SetCookie(w, &http.Cookie{
			Name:     "unlocked_csrf_token",
			Value:    uniqueId,
			Expires:  time.Now().Add(24 * time.Hour),
			HttpOnly: true,
			Secure:   true,
			Path:     "/",
		})
		_, err = bucket.Put(uniqueId, []byte(time.Now().Add(24*time.Hour).String()))
		if err != nil {
			log.WithFields(fields).Errorf("Failed to set CSRF token: %v", err)
			srv.errorResponse(w, http.StatusInternalServerError, "failed to write CSRF token")
			return
		}
		ctx := context.WithValue(r.Context(), CsrfTokenCtx, string(uniqueId))
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (srv *Server) rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fields := log.Fields{"handler": "rateLimitMiddleware"}
		kv := srv.buckets[RateLimit]
		hashedValue, err := getUniqueRequestInfo(r)
		if err != nil {
			log.WithFields(fields).Errorf("Failed to get unique request info: %v", err)
			srv.errorResponse(w, http.StatusInternalServerError, "failed to write CSRF token")
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
				srv.errorResponse(w, http.StatusInternalServerError, "failed to write CSRF token")
				return
			}
			next.ServeHTTP(w, r)
			return
		} else {
			var reqInfo requestInfo
			if err := json.Unmarshal(value.Value(), &reqInfo); err != nil {
				log.WithFields(fields).Errorf("Failed to unmarshal request info: %v", err)
				srv.errorResponse(w, http.StatusInternalServerError, "failed to decode request info")
				return
			}
			if time.Since(reqInfo.Timestamp) > timeWindow {
				reqInfo.Count = 0
				reqInfo.Timestamp = time.Now()
			} else {
				reqInfo.Count++
				if reqInfo.Count > maxRequests {
					srv.errorResponse(w, http.StatusTooManyRequests, "rate limit exceeded")
					return
				}
			}
			if err := putRequestInfo(kv, hashedValue, &reqInfo); err != nil {
				log.WithFields(fields).Errorf("Failed to marshal request info: %v", err)
				srv.errorResponse(w, http.StatusInternalServerError, "failed to write CSRF token")
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
	uniq := r.Header.Get("X-Real-IP")
	if uniq == "" {
		uniq = r.Header.Get("X-Forwarded-For")
		if uniq == "" {
			uniq = r.RemoteAddr
		}
	}
	unique := r.Header.Get("User-Agent") + uniq + csrf
	hashedValue := shaHashValue(unique)
	return hashedValue, nil
}

func shaHashValue(value string) string {
	hash := sha256.New()
	hash.Write([]byte(value))
	return fmt.Sprintf("%x", hash.Sum(nil))
}
