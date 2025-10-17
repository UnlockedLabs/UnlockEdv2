package integration

import (
	"UnlockEdv2/src/handlers"
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCSRFMiddleware(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Test Facility")
	require.NoError(t, err)

	claims := &handlers.Claims{
		UserID:     1,
		Role:       models.SystemAdmin,
		FacilityID: facility.ID,
	}

	t.Run("POST request without CSRF token returns 403", func(t *testing.T) {
		claimsJSON, _ := json.Marshal(claims)
		NewRequest[any](env.Client, t, http.MethodPost, "/api/users", map[string]string{"test": "data"}).
			WithHeader("X-Test-Claims", string(claimsJSON)).
			Do().
			ExpectStatus(http.StatusForbidden).
			ExpectBodyContains("CSRF token missing")
	})

	t.Run("POST request with invalid CSRF token returns 403", func(t *testing.T) {
		claimsJSON, _ := json.Marshal(claims)
		NewRequest[any](env.Client, t, http.MethodPost, "/api/users", map[string]string{"test": "data"}).
			WithHeader("X-Test-Claims", string(claimsJSON)).
			WithHeader("X-CSRF-Token", "invalid-token").
			WithHeader("Cookie", "csrf_token=valid-token-12345678901234567890123456789012").
			Do().
			ExpectStatus(http.StatusForbidden).
			ExpectBodyContains("CSRF token invalid")
	})

	t.Run("POST request with valid CSRF token succeeds", func(t *testing.T) {
		token := "test-csrf-token-12345678901234567890123456789012"

		req := NewRequest[any](env.Client, t, http.MethodPost, "/api/users", map[string]any{
			"user": map[string]any{
				"username":    "testuser",
				"name_first":  "Test",
				"name_last":   "User",
				"role":        "student",
				"email":       "test@example.com",
				"doc_id":      "123",
				"facility_id": facility.ID,
			},
			"provider_platforms": []int{},
		}).
			WithTestClaims(claims).
			WithHeader("X-CSRF-Token", token).
			WithHeader("Cookie", "csrf_token="+token)

		resp := req.Do()

		require.NotEqual(t, http.StatusForbidden, resp.resp.StatusCode,
			"Expected non-403 status with valid CSRF token, got body: %s", resp.rawBody)
	})

	t.Run("GET request works without CSRF token", func(t *testing.T) {
		resp := NewRequest[any](env.Client, t, http.MethodGet, "/api/healthcheck", nil).
			AsRaw().
			Do()

		require.Equal(t, http.StatusOK, resp.resp.StatusCode)
	})

	t.Run("HEAD request works without CSRF token", func(t *testing.T) {
		resp := NewRequest[any](env.Client, t, http.MethodHead, "/api/healthcheck", nil).
			AsRaw().
			Do()

		require.NotEqual(t, http.StatusForbidden, resp.resp.StatusCode)
	})

	t.Run("OPTIONS request works without CSRF token", func(t *testing.T) {
		resp := NewRequest[any](env.Client, t, http.MethodOptions, "/api/users", nil).
			Do()

		require.NotEqual(t, http.StatusForbidden, resp.resp.StatusCode)
	})
}
