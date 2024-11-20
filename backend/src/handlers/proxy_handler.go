package handlers

import (
	"UnlockEdv2/src/models"
	"crypto/tls"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
)

func (srv *Server) registerProxyRoutes() {
	srv.Mux.Handle("GET /api/proxy/libraries/{id}/", srv.libraryProxyMiddleware(http.HandlerFunc(srv.handleForwardKiwixProxy)))
	if os.Getenv("S3_BUCKET_NAME") != "" {
		// only register this route if we are in production and need this endpoint to proxy videos from S3
		srv.Mux.Handle("GET /videos/{id}", srv.videoProxyMiddleware(http.HandlerFunc(srv.handleRedirectVideosS3)))
	}
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
	proxy := httputil.ReverseProxy{
		Director: func(req *http.Request) {
			req.URL.Scheme = "https"
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

func (srv *Server) handleRedirectVideosS3(w http.ResponseWriter, r *http.Request) {
	bucket := os.Getenv("S3_BUCKET_NAME")
	video := r.Context().Value(videoKey).(*models.Video)
	if bucket == "" || video == nil {
		http.Error(w, "S3 bucket not configured", http.StatusInternalServerError)
		return
	}
	key := video.GetS3KeyMp4()
	sess, err := session.NewSession(&aws.Config{
		Region: aws.String(os.Getenv("AWS_REGION")),
	})
	if err != nil {
		http.Error(w, "Could not create S3 session", http.StatusInternalServerError)
		return
	}
	svc := s3.New(sess)
	req, _ := svc.GetObjectRequest(&s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	presignedURL, err := req.Presign(getTimeoutFromDuration(video.Duration))
	if err != nil {
		http.Error(w, "Could not generate pre-signed URL", http.StatusInternalServerError)
		return
	}
	http.Redirect(w, r, presignedURL, http.StatusTemporaryRedirect)
}

func getTimeoutFromDuration(duration int) time.Duration {
	return time.Duration(duration) * (time.Second * 2)
}
