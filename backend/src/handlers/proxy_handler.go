package handlers

import (
	"UnlockEdv2/src/models"
	"crypto/tls"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/sirupsen/logrus"
)

func (srv *Server) registerProxyRoutes() {
	srv.Mux.Handle("GET /api/proxy/libraries/{id}/", srv.libraryProxyMiddleware(http.HandlerFunc(srv.handleForwardKiwixProxy)))
	srv.Mux.Handle("GET /api/proxy/videos/{id}", srv.videoProxyMiddleware(http.HandlerFunc(srv.handleRedirectVideosS3)))
}

func (srv *Server) handleForwardKiwixProxy(w http.ResponseWriter, r *http.Request) {
	library, ok := r.Context().Value(libraryKey).(*models.LibraryProxyPO)
	if !ok {
		srv.errorResponse(w, http.StatusNotFound, "Library context not found")
		return
	}
	assetPath := strings.TrimPrefix(r.URL.Path, fmt.Sprintf("/api/proxy/libraries/%d", library.ID))
	if assetPath != "" && assetPath != "/" {
		assetPath = strings.TrimPrefix(assetPath, library.Path)
	}
	targetURL, err := url.JoinPath(library.BaseUrl, library.Path, assetPath)
	if err != nil {
		srv.errorResponse(w, http.StatusBadRequest, "Malformed request to build targetURL")
		return
	}
	parsedURL, err := url.Parse(targetURL)
	if err != nil {
		srv.errorResponse(w, http.StatusBadRequest, "Error parsing target URL")
		return
	}
	scheme := "https"
	if srv.dev {
		scheme = "http"
	}
	proxy := httputil.ReverseProxy{
		Director: func(req *http.Request) {
			req.URL.Scheme = scheme
			req.URL.Host = parsedURL.Host
			req.Host = parsedURL.Host

			req.URL.Path = parsedURL.Path
			req.URL.RawQuery = r.URL.RawQuery
			req.Header.Set("X-Real-IP", r.RemoteAddr)
			req.Header.Set("X-Forwarded-For", r.RemoteAddr)
			req.Header.Set("X-Forwarded-Proto", "https")
		},
		Transport: &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			TLSClientConfig: &tls.Config{
				MinVersion:         tls.VersionTLS12,
				InsecureSkipVerify: true,
			},
		},
		ModifyResponse: func(res *http.Response) error {
			//MAKE SURE TO NOT CACHE MAIN HTML CONTENT | WE MAY NEED TO ADD OTHER CONTENT TYPE TO NOT CACHE
			contentType := res.Header.Get("Content-Type")
			if contentType == "text/html" || contentType == "" {
				res.Header.Set("Cache-Control", "no-store, no-cache, must-revalidate, private")
				res.Header.Set("Pragma", "no-cache") //setting this in case HTTP/1.1 is not supported
			}
			if res.StatusCode == http.StatusFound || res.StatusCode == http.StatusSeeOther || res.StatusCode == http.StatusMovedPermanently {
				location := res.Header.Get("Location")
				if location != "" {
					parsedLocation, err := url.Parse(location)
					if err != nil {
						return err
					}
					finalParsedLocation, err := url.JoinPath(fmt.Sprintf("/api/proxy/libraries/%d", library.ID), parsedLocation.Path)
					if err != nil {
						return err
					}
					res.Header.Set("Location", finalParsedLocation)
				}
			}
			return nil
		},
	}
	proxy.ServeHTTP(w, r)
}

func (srv *Server) handleRedirectVideosLocal(w http.ResponseWriter, r *http.Request, video *models.Video) {
	http.Redirect(w, r, fmt.Sprintf("/videos/%s.mp4", video.ExternalID), http.StatusTemporaryRedirect)
}

func (srv *Server) handleRedirectVideosS3(w http.ResponseWriter, r *http.Request) {
	video := r.Context().Value(videoKey).(*models.Video)
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
		srv.errorResponse(w, http.StatusInternalServerError, "Error generating presigned URL")
		return
	}
	http.Redirect(w, r, presignedURL.URL, http.StatusTemporaryRedirect)
}

func getTimeoutFromDuration(duration int) time.Duration {
	return time.Duration(duration) * (time.Second * 2)
}
