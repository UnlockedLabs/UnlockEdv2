package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestVersionInfo(t *testing.T) {
	t.Run("falls back to unknown when env vars are unset", func(t *testing.T) {
		t.Setenv("APP_VERSION", "")
		t.Setenv("GIT_COMMIT", "")
		t.Setenv("GIT_BRANCH", "")

		got := versionInfo()
		want := versionResponse{Version: "unknown", Commit: "unknown", Branch: "unknown"}
		if got != want {
			t.Errorf("versionInfo() = %+v, want %+v", got, want)
		}
	})

	t.Run("reports env vars when set", func(t *testing.T) {
		t.Setenv("APP_VERSION", "1.2.3")
		t.Setenv("GIT_COMMIT", "abc1234")
		t.Setenv("GIT_BRANCH", "main")

		got := versionInfo()
		want := versionResponse{Version: "1.2.3", Commit: "abc1234", Branch: "main"}
		if got != want {
			t.Errorf("versionInfo() = %+v, want %+v", got, want)
		}
	})
}

func TestHandleVersion(t *testing.T) {
	srv := newTestingServer()
	srv.registerVersionRoute()

	t.Setenv("APP_VERSION", "1.2.3")
	t.Setenv("GIT_COMMIT", "abc1234")
	t.Setenv("GIT_BRANCH", "main")

	tests := []struct {
		name       string
		method     string
		wantStatus int
	}{
		{name: "GET returns the version", method: http.MethodGet, wantStatus: http.StatusOK},
		{name: "POST is rejected", method: http.MethodPost, wantStatus: http.StatusMethodNotAllowed},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			srv.Mux.ServeHTTP(w, httptest.NewRequest(tt.method, "/api/version", nil))

			require.Equal(t, tt.wantStatus, w.Code, w.Body.String())
			if tt.wantStatus != http.StatusOK {
				return
			}
			assert.Equal(t, "application/json", w.Header().Get("Content-Type"))

			var got versionResponse
			require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
			assert.Equal(t, versionResponse{Version: "1.2.3", Commit: "abc1234", Branch: "main"}, got)
		})
	}
}
