package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
)

func TestHandleIndexLibraries(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetLibrariesAsUser", "student", map[string]any{"page": 1, "per_page": 10, "visibility": "visible", "search": "", "provider_id": 0}, http.StatusOK, "?page=1&per_page=10"},
		{"TestGetLibrariesAsUserShowHidden", "student", map[string]any{"page": 1, "per_page": 10, "visibility": "hidden", "search": "", "provider_id": 0}, http.StatusUnauthorized, "?page=1&per_page=10&visibility=hidden"},
		{"TestGetLibrariesAsAdmin", "admin", map[string]any{"page": 1, "per_page": 10, "visibility": "", "search": "", "provider_id": 0}, http.StatusOK, "?page=1&per_page=10"},
		{"TestGetLibrariesAsAdmin", "admin", map[string]any{"page": 1, "per_page": 10, "visibility": "hidden", "search": "", "provider_id": 0}, http.StatusOK, "?page=1&per_page=10&visibility=hidden&provider_id=0"},
		{"TestGetLibrariesAsAdmin", "admin", map[string]any{"page": 1, "per_page": 10, "visibility": "hidden", "search": "", "provider_id": 1}, http.StatusOK, "?page=1&per_page=10&visibility=hidden&provider_id=1"},
		{"TestGetLibrariesAsAdminOnlyVisible", "admin", map[string]any{"page": 1, "per_page": 10, "visibility": "visible", "search": "", "provider_id": 0}, http.StatusOK, "?page=1&per_page=10&visibility=visible"},
		{"TestGetLibrariesAsAdminOnlyHidden", "admin", map[string]any{"page": 1, "per_page": 10, "visibility": "hidden", "search": "", "provider_id": 0}, http.StatusOK, "?page=1&per_page=10&visibility=hidden"},
		{"TestGetLibrariesAsAdminWithParams", "admin", map[string]any{"page": 1, "per_page": 10, "visibility": "", "search": "python", "provider_id": 0}, http.StatusOK, "?page=1&per_page=10&search=python"},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/libraries%v", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRole(server.handleIndexLibraries, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				_, expectedLibraries, err := server.Db.GetAllLibraries(test.mapKeyValues["page"].(int), test.mapKeyValues["per_page"].(int), test.mapKeyValues["visibility"].(string), test.mapKeyValues["search"].(string), test.mapKeyValues["provider_id"].(int))
				if err != nil {
					t.Fatalf("unable to get libraries, error is %v", err)
				}
				data := models.PaginatedResource[models.Library]{}
				received := rr.Body.String()
				if err = json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if len(data.Data) != len(expectedLibraries) {
					t.Errorf("handler returned wrong number of libraries: got %v want %v", len(data.Data), len(expectedLibraries))
				}
				for _, expectedLib := range expectedLibraries {
					if !slices.ContainsFunc(data.Data, func(l models.Library) bool {
						return l.ID == expectedLib.ID
					}) {
						t.Error("library not found, out of sync")
					}
				}
			}
		})
	}
}

func TestHandleToggleLibrary(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminCanToggleLibrary", "admin", map[string]any{"id": "1", "message": "Library visibility updated successfully"}, http.StatusOK, ""},
		{"TestUserCannotToggleLibrary", "student", map[string]any{"id": "1"}, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodPut, "/api/libraries/", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRoleWithMiddleware(server.handleToggleLibraryVisibility, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if data.Message != test.mapKeyValues["message"] {
					t.Errorf("handler returned wrong body: got %v want %v", data.Message, test.mapKeyValues["message"])
				}
				// checks toggling visibility back
				req.SetPathValue("id", test.mapKeyValues["id"].(string))
				rr = httptest.NewRecorder()
				handler.ServeHTTP(rr, req)
				received = rr.Body.String()
				data = models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if data.Message != test.mapKeyValues["message"] {
					t.Errorf("handler returned wrong body: got %v want %v", data.Message, test.mapKeyValues["message"])
				}
			}
		})
	}
}
