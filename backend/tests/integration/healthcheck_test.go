package integration

import (
	"net/http"
	"testing"
)

func TestHealthCheckEndpointHandler(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()

	t.Run("Healthcheck returns OK", func(t *testing.T) {
		NewRequest[string](env.Client, t, http.MethodGet, "/api/healthcheck", nil).
			AsRaw().
			Do().
			ExpectStatus(http.StatusOK).
			ExpectRaw("OK")
	})
}
