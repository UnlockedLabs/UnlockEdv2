package integration

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSecurityHeaders(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	t.Run("API responses include security headers", func(t *testing.T) {
		resp := NewRequest[string](env.Client, t, http.MethodGet, "/api/healthcheck", nil).
			AsRaw().
			Do()

		resp.ExpectStatus(http.StatusOK)

		headers := resp.resp.Header

		require.Equal(t, "DENY", headers.Get("X-Frame-Options"),
			"X-Frame-Options header should be DENY")

		require.Equal(t, "nosniff", headers.Get("X-Content-Type-Options"),
			"X-Content-Type-Options header should be nosniff")

		require.Equal(t, "max-age=31536000; includeSubDomains", headers.Get("Strict-Transport-Security"),
			"Strict-Transport-Security header should be set")

		require.Equal(t, "strict-origin-when-cross-origin", headers.Get("Referrer-Policy"),
			"Referrer-Policy header should be strict-origin-when-cross-origin")
	})

	t.Run("Security headers present on all HTTP methods", func(t *testing.T) {
		methods := []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions}

		for _, method := range methods {
			t.Run(method, func(t *testing.T) {
				resp := NewRequest[any](env.Client, t, method, "/api/healthcheck", nil).
					AsRaw().
					Do()

				headers := resp.resp.Header
				require.NotEmpty(t, headers.Get("X-Frame-Options"),
					"X-Frame-Options header missing for %s", method)
				require.NotEmpty(t, headers.Get("X-Content-Type-Options"),
					"X-Content-Type-Options header missing for %s", method)
			})
		}
	})
}
