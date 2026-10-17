package handlers

import (
	"encoding/json"
	"net/http"
	"os"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerVersionRoute() {
	srv.Mux.HandleFunc("GET /api/version", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(versionInfo()); err != nil {
			log.Errorln("Error writing version response: ", err)
		}
	})
}

type versionResponse struct {
	Version string `json:"version"`
	Commit  string `json:"commit"`
	Branch  string `json:"branch"`
}

// Reports the build-time GIT_COMMIT/GIT_BRANCH/APP_VERSION baked into the image (see
// backend/Dockerfile), matching the tutor service's /api/version pattern.
func versionInfo() versionResponse {
	return versionResponse{
		Version: envOrDefault("APP_VERSION", "unknown"),
		Commit:  envOrDefault("GIT_COMMIT", "unknown"),
		Branch:  envOrDefault("GIT_BRANCH", "unknown"),
	}
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
