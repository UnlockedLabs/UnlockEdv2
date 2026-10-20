package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/UnlockedLabs/unlocked-core/backend/src/models"
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"

	"github.com/UnlockedLabs/unlocked-contracts/identity"
	"github.com/sirupsen/logrus"
	logtest "github.com/sirupsen/logrus/hooks/test"
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

// A module handler sees who is calling as identity.Claims, without core's
// Kratos and password-reset details.
func TestModuleRouterClaims(t *testing.T) {
	srv := newTestingServer()
	var got *identity.Claims
	moduleRouter{srv}.Handle(module.Route{Pattern: "GET /api/test-module/claims", Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got, _ = identity.FromContext(r.Context())
	})})

	caller := Claims{
		UserID: 7, Username: "jdoe", Email: "jdoe@example.com", Role: models.Student, FacilityID: 2,
		FacilityName: "North", KratosID: "k-1", FeatureAccess: []models.FeatureAccess{models.OpenContentAccess},
		SessionID: "s-1", DocID: "1001", TimeZone: "America/Chicago",
	}
	srv.Mux.ServeHTTP(httptest.NewRecorder(), requestAs(t, "/api/test-module/claims", caller))

	want := &identity.Claims{
		UserID: 7, Username: "jdoe", Role: models.Student, FacilityID: 2, FacilityName: "North",
		FeatureAccess: []models.FeatureAccess{models.OpenContentAccess}, SessionID: "s-1", TimeZone: "America/Chicago",
	}
	assert.Equal(t, want, got)
}

// A module's audit action lands on the same admin audit log line as a core
// handler's log.auditDetails.
func TestModuleRouterAuditAction(t *testing.T) {
	srv := newTestingServer()
	moduleRouter{srv}.Handle(module.Route{Pattern: "PUT /api/test-module/audit", Access: module.Admin, Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		module.AuditAction(r.Context(), "video_featured")
	})})

	hook := logtest.NewGlobal()
	defer logrus.StandardLogger().ReplaceHooks(make(logrus.LevelHooks))

	r := requestAs(t, "/api/test-module/audit", Claims{UserID: 3, Username: "facadmin", Role: models.FacilityAdmin, FacilityID: 2})
	r.Method = http.MethodPut
	r.Header.Set("X-CSRF-Token", "token")
	r.AddCookie(&http.Cookie{Name: "csrf_token", Value: "token"})
	w := httptest.NewRecorder()
	srv.Mux.ServeHTTP(w, r)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var audit *logrus.Entry
	for _, e := range hook.AllEntries() {
		if e.Data["audit"] == "admin_action" {
			audit = e
		}
	}
	require.NotNil(t, audit, "no admin audit log line")
	assert.Equal(t, "video_featured", audit.Data["action"])
	assert.Equal(t, uint(3), audit.Data["admin_id"])
}

// Module messages reach the user's open tab as the websocket's own message
// shape, and are dropped when the server has no websocket.
func TestWsNotifier(t *testing.T) {
	msg := module.Message{Event: "visits", ActivityID: 42, Text: "hi"}

	t.Run("no websocket", func(t *testing.T) {
		assert.NotPanics(t, func() { wsNotifier{newTestingServer()}.Notify(7, msg) })
	})

	t.Run("open tab", func(t *testing.T) {
		srv := newTestingServer()
		srv.wsClient = newClientManager()
		client := &WsClient{UserID: 7, sendChan: make(chan []byte, 1)}
		srv.wsClient.clients[7] = client

		wsNotifier{srv}.Notify(7, msg)

		assert.JSONEq(t, `{"event_type":"visits","user_id":7,"session_id":"","msg":{"activity_id":42,"msg":"hi"}}`, string(<-client.sendChan))
		// The websocket ends this activity when the tab closes.
		assert.Equal(t, int64(42), client.OpenContentActivityID)
	})
}
