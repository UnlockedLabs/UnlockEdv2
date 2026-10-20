package opencontent

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/UnlockedLabs/unlocked-contracts/features"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/sirupsen/logrus"
)

// The library proxy forwards to Kiwix, and the video proxy redirects to the
// video file. Both moved from core's handlers unchanged (EN-192).

type contextKey string

const (
	libraryKey contextKey = "library"
	videoKey   contextKey = "video"
	// authCallbackRoute is core's login callback, where a user without Open
	// Content is sent.
	authCallbackRoute = "/authcallback"
)

// resourceRegExpression matches the asset requests a page makes, which are
// not recorded as visits.
var resourceRegExpression = regexp.MustCompile(`\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|ttf|map|webp|otf|vtt|webm|json|woff2|pdf)(\?|%3F|$)`)

func (srv *server) videoProxyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := claimsFrom(r)
		if !user.HasFeature(features.OpenContent) {
			http.Redirect(w, r, authCallbackRoute, http.StatusSeeOther)
			return
		}
		video, err := srv.store.findVideoProxy(r.PathValue("id"), user.FacilityID, user.IsAdmin())
		if err != nil {
			errorResponse(w, http.StatusNotFound, "Video not found, is not available or visibility is not enabled")
			return
		}
		ctx := context.WithValue(r.Context(), videoKey, video)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (srv *server) libraryProxyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := claimsFrom(r)
		if !user.HasFeature(features.OpenContent) {
			http.Redirect(w, r, authCallbackRoute, http.StatusSeeOther)
			return
		}
		resourceID := r.PathValue("id")
		proxyParams, ok := srv.libraryProxyParams(resourceID, user.FacilityID)
		if !ok {
			errorResponse(w, http.StatusNotFound, "Library not found.")
			return
		}
		if !user.IsAdmin() && !proxyParams.VisibilityStatus {
			errorResponse(w, http.StatusNotFound, "Visibility is not enabled")
			return
		}
		urlString := r.URL.String()
		if !resourceRegExpression.MatchString(urlString) && !strings.Contains(urlString, "iframe") {
			activity := OpenContentActivity{
				OpenContentProviderID: proxyParams.OpenContentProviderID,
				FacilityID:            user.FacilityID,
				UserID:                user.UserID,
				ContentID:             proxyParams.ID,
			}
			if !user.IsAdmin() {
				srv.createContentActivityAndNotifyWS(urlString, &activity)
			}
		}
		ctx := context.WithValue(r.Context(), libraryKey, proxyParams)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// libraryProxyParams is the library's proxy target, from the library_paths
// cache when it is there, and otherwise from the database, then cached.
func (srv *server) libraryProxyParams(resourceID string, facilityID uint) (*LibraryProxyPO, bool) {
	if proxyParams, ok := srv.cachedLibraryProxy(resourceID); ok {
		return proxyParams, true
	}
	library, ok := srv.store.findLibraryProxy(resourceID, facilityID)
	if !ok {
		return nil, false
	}
	proxyParams := library.IntoProxyPO()
	srv.cacheLibraryProxy(resourceID, proxyParams)
	return proxyParams, true
}

// cachedLibraryProxy reads the library_paths cache. There is no cache
// without NATS, as in tests.
func (srv *server) cachedLibraryProxy(resourceID string) (*LibraryProxyPO, bool) {
	if srv.libraryPaths == nil {
		return nil, false
	}
	entry, err := srv.libraryPaths.Get(resourceID)
	if err != nil {
		return nil, false
	}
	var proxyParams *LibraryProxyPO
	if err := json.Unmarshal(entry.Value(), &proxyParams); err != nil {
		logrus.Warnf("issue unmarshaling LibraryProxyPO from nats bucket, error is: %v", err)
		return nil, false
	}
	return proxyParams, true
}

func (srv *server) cacheLibraryProxy(resourceID string, proxyParams *LibraryProxyPO) {
	if srv.libraryPaths == nil {
		return
	}
	marshaledParams, err := json.Marshal(proxyParams)
	if err != nil {
		logrus.Warnf("issue marshaling LibraryProxyPO, error is: %v", err)
		return
	}
	if _, err := srv.libraryPaths.Put(resourceID, marshaledParams); err != nil {
		logrus.Warnf("issue putting LibraryProxyPO into bucket, error is: %v", err)
	}
}

func (srv *server) handleForwardKiwixProxy(w http.ResponseWriter, r *http.Request) {
	library, ok := r.Context().Value(libraryKey).(*LibraryProxyPO)
	if !ok {
		errorResponse(w, http.StatusNotFound, "Library context not found")
		return
	}
	// Use RawPath if present to preserve double-encoded segments
	rawPath := r.URL.RawPath
	if rawPath == "" {
		rawPath = r.URL.EscapedPath()
	}
	assetPath := strings.TrimPrefix(rawPath, fmt.Sprintf("/api/proxy/libraries/%d", library.ID))
	if assetPath != "" && assetPath != "/" {
		assetPath = strings.TrimPrefix(assetPath, library.Path)
	}
	// Build final encoded path manually to avoid url.JoinPath normalization
	libPart := "/" + strings.Trim(library.Path, "/")
	if assetPath != "" && !strings.HasPrefix(assetPath, "/") {
		assetPath = "/" + assetPath
	}
	finalEncodedPath := libPart + assetPath
	// Reconstruct full target URL string without JoinPath (to preserve encoding)
	base := strings.TrimRight(library.BaseUrl, "/")
	targetURL := base + finalEncodedPath
	parsedURL, err := url.Parse(targetURL)
	if err != nil {
		errorResponse(w, http.StatusBadRequest, "Error parsing target URL")
		return
	}
	// Determine upstream scheme. Default to https; allow http only in dev when explicitly configured.
	scheme := "https"
	if srv.dev && parsedURL.Scheme == "http" {
		// Prefer the parsed target URL's scheme if it's http.
		scheme = "http"
	}
	//we have a special deploy currently in stlouis deployment which is why this is need
	//if we ever have any other deployments that need this we have an easy switch value to use
	if os.Getenv("PROXY_SCHEME_OVERRIDE") == "true" {
		scheme = "http"
	}
	proxy := httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.Out.URL.Scheme = scheme
			pr.Out.URL.Host = parsedURL.Host
			pr.Out.Host = parsedURL.Host
			decodedPath, _ := url.QueryUnescape(finalEncodedPath)
			pr.Out.URL.Path = decodedPath
			pr.Out.URL.RawPath = finalEncodedPath
			pr.Out.URL.RawQuery = r.URL.RawQuery
			pr.Out.Header.Set("X-Real-IP", r.RemoteAddr)
			pr.Out.Header.Set("X-Forwarded-For", r.RemoteAddr)
			pr.Out.Header.Set("X-Forwarded-Proto", scheme)
		},
		Transport: &http.Transport{
			Proxy:           http.ProxyFromEnvironment,
			TLSClientConfig: &tls.Config{MinVersion: tls.VersionTLS12, InsecureSkipVerify: false},
		},
		ModifyResponse: func(res *http.Response) error {
			contentType := res.Header.Get("Content-Type")
			if contentType == "text/html" || contentType == "" {
				res.Header.Set("Cache-Control", "no-store, no-cache, must-revalidate, private")
				res.Header.Set("Pragma", "no-cache")
			}
			if res.StatusCode == http.StatusFound || res.StatusCode == http.StatusSeeOther || res.StatusCode == http.StatusMovedPermanently {
				location := res.Header.Get("Location")
				if location != "" {
					parsedLocation, err := url.Parse(location)
					if err != nil {
						return err
					}
					res.Header.Set("Location", fmt.Sprintf("/api/proxy/libraries/%d%s", library.ID, parsedLocation.Path))
				}
			}
			return nil
		},
	}
	proxy.ServeHTTP(w, r)
}

func (srv *server) handleRedirectVideosLocal(w http.ResponseWriter, r *http.Request, video *Video) {
	http.Redirect(w, r, fmt.Sprintf("/videos/%s.mp4", video.ExternalID), http.StatusTemporaryRedirect)
}

func (srv *server) handleRedirectVideosS3(w http.ResponseWriter, r *http.Request) {
	video := r.Context().Value(videoKey).(*Video)
	if srv.dev || video == nil || srv.s3Bucket == "" {
		srv.handleRedirectVideosLocal(w, r, video)
		return
	}
	logrus.Tracef("Redirecting to S3 for video %s", r.URL.Path)
	presignParams := &s3.GetObjectInput{
		Bucket: aws.String(srv.s3Bucket),
		Key:    aws.String(video.GetS3KeyMp4()),
	}
	presignedURL, err := srv.presigner.PresignGetObject(r.Context(), presignParams, func(opts *s3.PresignOptions) {
		opts.Expires = getTimeoutFromDuration(video.Duration)
	})
	if err != nil {
		logrus.Errorf("Error generating presigned URL: %v", err)
		errorResponse(w, http.StatusInternalServerError, "Error generating presigned URL")
		return
	}
	http.Redirect(w, r, presignedURL.URL, http.StatusTemporaryRedirect)
}

func getTimeoutFromDuration(duration int) time.Duration {
	return time.Duration(duration) * (time.Second * 2)
}
