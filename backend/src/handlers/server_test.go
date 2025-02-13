package handlers

import (
	"UnlockEdv2/src/models"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

var server *Server

type httpTest struct {
	testName           string
	role               string
	mapKeyValues       map[string]any
	expectedStatusCode int
	queryParams        string
}

func setupServer() {
	server = NewServer(true)
}

func TestMain(m *testing.M) {
	setupServer()
	exitVal := m.Run()
	os.Exit(exitVal)
}

func (srv *Server) applyAdminTestingMiddleware(h http.Handler) http.Handler {
	return srv.adminMiddleware(h)
}

func executeRequest(t *testing.T, req *http.Request, handler http.Handler, test httpTest) *httptest.ResponseRecorder {
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if status := rr.Code; status != test.expectedStatusCode {
		t.Errorf("handler returned wrong status code: got %v want %v", status, test.expectedStatusCode)
	}
	return rr
}

func (srv *Server) TestAsAdmin(handler HttpFunc) http.Handler {
	h := srv.applyAdminTestingMiddleware(srv.handleError(handler))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		testClaims := &Claims{
			UserID:        1,
			PasswordReset: false,
			Role:          models.DepartmentAdmin,
			FacilityID:    1,
		}
		ctx := context.WithValue(r.Context(), ClaimsKey, testClaims)
		test_ctx := context.WithValue(ctx, TestingClaimsKey, true)
		h.ServeHTTP(w, r.WithContext(test_ctx))
	})
}

func (srv *Server) TestAsUserWithAdminMiddleware(handler HttpFunc) http.Handler {
	return srv.applyAdminTestingMiddleware(srv.TestAsUser(handler))
}

func (srv *Server) TestAsUser(handler HttpFunc) http.HandlerFunc {
	h := srv.handleError(handler)
	return func(w http.ResponseWriter, r *http.Request) {
		testClaims := &Claims{
			UserID:        4,
			Role:          models.Student,
			PasswordReset: false,
			FacilityID:    1,
		}
		ctx := context.WithValue(r.Context(), ClaimsKey, testClaims)
		test_ctx := context.WithValue(ctx, TestingClaimsKey, true)
		h.ServeHTTP(w, r.WithContext(test_ctx))
	}
}

func getHandlerByRoleWithMiddleware(httpFunc HttpFunc, role string) http.Handler {
	var handler http.Handler
	if role == "admin" {
		handler = server.TestAsAdmin(httpFunc)
	} else {
		handler = server.TestAsUserWithAdminMiddleware(httpFunc)
	}
	return handler
}

func getHandlerByRole(httpFunc HttpFunc, role string) http.Handler {
	var handler http.Handler
	if role == "admin" {
		handler = server.TestAsAdmin(httpFunc)
	} else {
		handler = server.TestAsUser(httpFunc)
	}
	return handler
}
