package handlers

import (
	"UnlockEdv2/src/models"
	"context"
	"net/http"
)

const (
	libraryKey contextKey = "library"
	videoKey   contextKey = "video"
	// rate limit is 50 requests from a unique user in a minute
)

func (srv *Server) applyMiddleware(h HttpFunc, accessLevel ...models.FeatureAccess) http.Handler {
	return srv.applyStandardMiddleware(
		srv.checkFeatureAccessMiddleware(
			srv.handleError(h), accessLevel...))
}

func (srv *Server) applyAdminMiddleware(h HttpFunc, accessLevel ...models.FeatureAccess) http.Handler {
	return srv.applyStandardMiddleware(
		srv.adminMiddleware(
			srv.checkFeatureAccessMiddleware(
				srv.handleError(h), accessLevel...)))
}

func (srv *Server) applyStandardMiddleware(next http.Handler) http.Handler {
	return srv.prometheusMiddleware(
		srv.authMiddleware(
			next))
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
		tx := srv.Db.Model(&models.Video{}).Where("id = ?", resourceID)
		if user.isAdmin() {
			tx = tx.First(&video)
		} else {
			tx = tx.First(&video, "visibility_status = true AND availability = 'available'")
		}
		if err := tx.Error; err != nil {
			srv.errorResponse(w, http.StatusNotFound, "Video not found, is not available or visibility is not enabled")
			return
		}
		ctx := context.WithValue(r.Context(), videoKey, &video)
		next.ServeHTTP(w, r.WithContext(ctx))
	}))
}

func (srv *Server) libraryProxyMiddleware(next http.Handler) http.Handler {
	return srv.applyStandardMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := r.Context().Value(ClaimsKey).(*Claims)
		if !srv.hasFeatureAccess(models.OpenContentAccess) {
			http.Redirect(w, r, AuthCallbackRoute, http.StatusSeeOther)
			return
		}
		resourceID := r.PathValue("id")
		var library models.Library
		tx := srv.Db.Model(&models.Library{}).Preload("OpenContentProvider").Where("id = ?", resourceID)
		if user.isAdmin() {
			tx = tx.First(&library)
		} else {
			tx = tx.First(&library, "visibility_status = true")
		}
		if err := tx.Error; err != nil {
			srv.errorResponse(w, http.StatusNotFound, "Library not found or visibility is not enabled")
			return
		}
		ctx := context.WithValue(r.Context(), libraryKey, &library)
		next.ServeHTTP(w, r.WithContext(ctx))
	}))
}

func corsMiddleware(next http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Length, X-Requested-With")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PATCH, PUT, DELETE")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r.WithContext(r.Context()))
	}
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
