package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"testing"
)

func TestHandleDeleteAllKratosIdentities(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotDeleteAllKratosIdentities", "student", nil, http.StatusUnauthorized, ""},
		{"TestAdminCanDeleteAllKratosIdentities", "admin", map[string]any{"message": "identities deleted successfully"}, http.StatusNoContent, ""}, //commented out till integration testing
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodDelete, "/api/identities/sync", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handleDeleteAllKratosIdentities, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusNoContent {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
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
