package handlers

import (
	"UnlockEdv2/src/models"
	"crypto/tls"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
)

func (srv *Server) registerProxyRoutes() {
	srv.Mux.Handle("GET /api/proxy/libraries/{id}/", srv.libraryProxyMiddleware(http.HandlerFunc(srv.handleForwardKiwixProxy)))
}

func (srv *Server) handleForwardKiwixProxy(w http.ResponseWriter, r *http.Request) {
	library, ok := r.Context().Value(libraryKey).(*models.Library)
	if !ok {
		srv.errorResponse(w, http.StatusNotFound, "Library context not found")
		return
	}
	assetPath := strings.TrimPrefix(r.URL.Path, fmt.Sprintf("/api/proxy/libraries/%d", library.ID))
	if assetPath != "" && assetPath != "/" {
		assetPath = strings.TrimPrefix(assetPath, library.Path)
	}
	targetURL, err := url.JoinPath(library.OpenContentProvider.BaseUrl, library.Path, assetPath)
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
