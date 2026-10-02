package integration

import (
	"UnlockEdv2/src/models"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

// EN-118: a login against a stale Kratos flow (an old tab or a bookmarked
// /login?flow=... URL) must come back as an expired session, not as bad
// credentials, and must not count toward the account lockout.
func TestLoginStaleFlow(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Login Flow Test Facility")
	require.NoError(t, err)

	tests := []struct {
		name         string
		flowID       string
		kratosStatus int
		kratosBody   string
		wantStatus   int
		wantAttempts int
	}{
		{
			name:         "successful login",
			flowID:       "valid-flow",
			kratosStatus: http.StatusOK,
			kratosBody:   `{"session":{"identity":{"traits":{"password_reset":false}}}}`,
			wantStatus:   http.StatusOK,
		},
		{
			name:         "expired flow",
			flowID:       "expired-flow",
			kratosStatus: http.StatusGone,
			kratosBody:   `{"error":{"id":"self_service_flow_expired"}}`,
			wantStatus:   http.StatusGone,
		},
		{
			name:         "unknown flow id",
			flowID:       "unknown-flow",
			kratosStatus: http.StatusNotFound,
			kratosBody:   `{"error":{"code":404}}`,
			wantStatus:   http.StatusGone,
		},
		{
			name:         "csrf cookie missing",
			flowID:       "stale-flow",
			kratosStatus: http.StatusForbidden,
			kratosBody:   `{"error":{"id":"security_csrf_violation"}}`,
			wantStatus:   http.StatusGone,
		},
		{
			name:       "missing flow id",
			flowID:     "",
			wantStatus: http.StatusGone,
		},
		{
			name:         "bad credentials",
			flowID:       "valid-flow",
			kratosStatus: http.StatusBadRequest,
			kratosBody:   `{"ui":{"messages":[{"id":4000006}]}}`,
			wantStatus:   http.StatusBadRequest,
			wantAttempts: 1,
		},
	}
	for i, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			kratos := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				require.Equal(t, tt.flowID, r.URL.Query().Get("flow"))
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tt.kratosStatus)
				_, _ = w.Write([]byte(tt.kratosBody))
			}))
			defer kratos.Close()
			t.Setenv("KRATOS_PUBLIC_URL", kratos.URL)
			env.Server.Client = kratos.Client()

			user, err := env.CreateTestUser(fmt.Sprintf("loginflowuser%d", i), models.Student, facility.ID, "")
			require.NoError(t, err)

			NewRequest[any](env.Client, t, http.MethodPost, "/api/login", map[string]string{
				"identifier": user.Username,
				"password":   "password",
				"flow_id":    tt.flowID,
				"csrf_token": "token",
			}).Do().ExpectStatus(tt.wantStatus)

			status, err := env.DB.IsAccountLocked(user.ID)
			require.NoError(t, err)
			require.Equal(t, tt.wantAttempts, int(status.AttemptCount))
		})
	}
}
