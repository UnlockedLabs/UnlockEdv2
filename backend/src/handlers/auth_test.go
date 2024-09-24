package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
	"testing"
)

func TestHandleCheckAuth(t *testing.T) {
	httpTests := []httpTest{
		{"TestCheckAuthAsAdmin", "admin", map[string]any{"id": "1"}, http.StatusOK, ""},
		{"TestCheckAuthAsUser", "student", map[string]any{"id": "4"}, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/auth", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRole(server.handleCheckAuth, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				id, _ := strconv.Atoi(test.mapKeyValues["id"].(string))
				user, err := server.Db.GetUserByID(uint(id))
				if err != nil {
					t.Fatalf("unable to retrieve user from db, error is %v", err)
				}
				data := models.Resource[map[string]interface{}]{}
				received := rr.Body.String()
				if err = json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if data.Data["name_first"].(string) != user.NameFirst {
					t.Errorf("handler returned unexpected results, wanted %v got %v", user.NameFirst, data.Data["name_first"])
				}

			}
		})
	}
}

// func getResetPasswordForm(password string) map[string]any {
// 	form := make(map[string]any)
// 	form["reset_password"] = ResetPasswordRequest{
// 		Password:     password,
// 		Confirm:      password,
// 		FacilityName: "A new name",
// 	}
// 	return form
// }

// func TestHandleResetPassword(t *testing.T) {
// 	httpTests := []httpTest{
// 		{"TestUserBadResetPassword", "student", getResetPasswordForm("itsd"), http.StatusBadRequest, ""},
// 		{"TestUserResetPassword", "student", getResetPasswordForm("Itsd01#IS"), http.StatusOK, ""},
// 		{"TestAdminResetPassword", "admin", getResetPasswordForm("Itsd01#IS"), http.StatusOK, ""},
// 	}
// 	for _, test := range httpTests {
// 		t.Run(test.testName, func(t *testing.T) {
// 			passwordMap := test.mapKeyValues
// 			jsonForm, err := json.Marshal(passwordMap["reset_password"])
// 			if err != nil {
// 				t.Fatalf("unable to marshal form, error is %v", err)
// 			}
// 			req, err := http.NewRequest(http.MethodPost, "/api/reset-password", bytes.NewBuffer(jsonForm))
// 			if err != nil {
// 				t.Fatal(err)
// 			}
// 			handler := getHandlerByRole(server.handleResetPassword, test.role)
// 			rr := executeRequest(t, req, handler, test)
// 			if test.expectedStatusCode == http.StatusOK {
// 				received := rr.Body.String()
// 				data := models.Resource[struct{}]{}
// 				if err := json.Unmarshal([]byte(received), &data); err != nil {
// 					t.Errorf("failed to unmarshal resource, error is %v", err)
// 				}
// 				if data.Message != "Password reset successfully" {
// 					t.Errorf("handler returned wrong body: got %v want %v", data.Message, "Password reset successfully")
// 				}
// 			}
// 		})
// 	}
// }
