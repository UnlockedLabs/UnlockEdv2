package handlers

import (
	"UnlockEdv2/src/models"
	"context"
	"encoding/json"
	"net/http"
	"regexp"
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
		urlString := r.URL.String()
		tx := srv.Db.Model(&models.Video{}).
			Select(`videos.*, 
            (CASE WHEN fvs.visibility_status IS NULL THEN false ELSE fvs.visibility_status END)
			AS visibility_status`).
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
		if !user.isAdmin() {
			activity := models.OpenContentActivity{
				OpenContentProviderID: video.OpenContentProviderID,
				ContentID:             video.ID,
				FacilityID:            user.FacilityID,
				UserID:                user.UserID,
			}
			srv.createContentActivityAndNotifyWS(urlString, &activity)
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
