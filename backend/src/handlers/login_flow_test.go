package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"testing"
)

func TestHandleLogout(t *testing.T) {
	httpTests := []httpTest{
		{"TestLogoutAsAdmin", "admin", map[string]any{"redirect_to": "/self-service/logout/browser"}, http.StatusOK, ""},
		{"TestLogoutAsUser", "student", map[string]any{"redirect_to": "/self-service/logout/browser"}, http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodPost, "/api/logout", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRole(server.handleLogout, test.role)
			rr := executeRequest(t, req, handler, test)
			data := models.Resource[map[string]interface{}]{}
			received := rr.Body.String()
			if err = json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("failed to unmarshal resource, error is %v", err)
			}
			if data.Data["redirect_to"].(string) != test.mapKeyValues["redirect_to"].(string) {
				t.Errorf("handler returned unexpected results, wanted %v got %v", test.mapKeyValues["redirect_to"].(string), data.Data["redirect_to"].(string))
			}
		})
	}
}
