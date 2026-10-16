package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/UnlockedLabs/unlocked-core/backend/src/models"
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// A module route's access level must get the same checks as core's own
// routes, through the real middleware.
func TestModuleRouterAccess(t *testing.T) {
	srv := newTestingServer()
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	router := moduleRouter{srv}
	levels := map[module.AccessLevel]string{
		module.AnyUser:     "/api/test-module/any-user",
		module.Admin:       "/api/test-module/admin",
		module.DeptAdmin:   "/api/test-module/dept-admin",
		module.SystemAdmin: "/api/test-module/system-admin",
	}
	for level, path := range levels {
		router.Handle(module.Route{Pattern: "GET " + path, Handler: ok, Access: level})
	}
	router.Handle(module.Route{Pattern: "GET /api/test-module/feature", Handler: ok, Features: []models.FeatureAccess{models.OpenContentAccess}})

	allowed, denied := http.StatusOK, http.StatusUnauthorized
	tests := []struct {
		role models.UserRole
		want map[module.AccessLevel]int
	}{
		{models.Student, map[module.AccessLevel]int{module.AnyUser: allowed, module.Admin: denied, module.DeptAdmin: denied, module.SystemAdmin: denied}},
		{models.FacilityAdmin, map[module.AccessLevel]int{module.AnyUser: allowed, module.Admin: allowed, module.DeptAdmin: denied, module.SystemAdmin: denied}},
		{models.DepartmentAdmin, map[module.AccessLevel]int{module.AnyUser: allowed, module.Admin: allowed, module.DeptAdmin: allowed, module.SystemAdmin: denied}},
		{models.SystemAdmin, map[module.AccessLevel]int{module.AnyUser: allowed, module.Admin: allowed, module.DeptAdmin: allowed, module.SystemAdmin: allowed}},
	}
	for _, tt := range tests {
		for level, path := range levels {
			t.Run(fmt.Sprintf("%s on %s", tt.role, path), func(t *testing.T) {
				w := httptest.NewRecorder()
				srv.Mux.ServeHTTP(w, requestAs(t, path, Claims{UserID: 1, FacilityID: 1, Role: tt.role}))
				assert.Equal(t, tt.want[level], w.Code, w.Body.String())
			})
		}
	}

	t.Run("a route's features are still checked", func(t *testing.T) {
		w := httptest.NewRecorder()
		srv.Mux.ServeHTTP(w, requestAs(t, "/api/test-module/feature", Claims{UserID: 1, FacilityID: 1, Role: models.SystemAdmin, FeatureAccess: []models.FeatureAccess{}}))
		assert.Equal(t, denied, w.Code, w.Body.String())
	})
}

// An access level core doesn't know stops startup rather than leaving the
// route open.
func TestModuleRouterUnknownAccessPanics(t *testing.T) {
	router := moduleRouter{newTestingServer()}
	assert.Panics(t, func() {
		router.Handle(module.Route{Pattern: "GET /api/test-module/unknown", Handler: http.NotFoundHandler(), Access: module.AccessLevel(99)})
	})
}

// requestAs builds a GET with the claims the testing server's auth middleware
// reads instead of a Kratos session.
func requestAs(t *testing.T, path string, claims Claims) *http.Request {
	t.Helper()
	body, err := json.Marshal(claims)
	require.NoError(t, err)
	r := httptest.NewRequest(http.MethodGet, path, nil)
	r.Header.Set("X-Test-Claims", string(body))
	return r
}
