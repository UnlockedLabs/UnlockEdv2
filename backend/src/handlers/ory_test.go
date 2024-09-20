package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"testing"
)

// added if !srv.isTesting(r) {} around third party call
func TestHandleDeleteAllKratosIdentities(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotDeleteAllKratosIdentities", "student", nil, http.StatusUnauthorized, ""},
		{"TestAdminCanDeleteAllKratosIdentities", "admin", map[string]any{"message": "identities deleted successfully"}, http.StatusOK, ""}, //commented out till integration testing
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodDelete, "/api/identities/sync", nil)
			if err != nil {
				t.Fatal(err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handleDeleteAllKratosIdentities, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal response message")
				}
				if data.Message != test.mapKeyValues["message"] {
					t.Errorf("handler returned wrong body: got %v want %v", data.Message, test.mapKeyValues["message"])
				}
			}
		})
	}
}
