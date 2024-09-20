package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"testing"
)

// func TestHandleMapProviderUser(t *testing.T) {
// 	httpTests := []httpTest{
// 		{"TestAdminCanMapProviderUser", "admin", getImportUserWithIdsForm(), http.StatusCreated, ""},
// 		{"TestUserCannotMapProviderUser", "student", getImportUserWithIdsForm(), http.StatusUnauthorized, ""},
// 	}
// 	for _, test := range httpTests {
// 		t.Run(test.testName, func(t *testing.T) {
// 			importUserMap := test.mapKeyValues
// 			if importUserMap["err"] != nil {
// 				t.Fatal("unable to import user form, error is ", importUserMap["err"])
// 			}
// 			jsonForm, err := json.Marshal(importUserMap)
// 			if err != nil {
// 				t.Errorf("failed to marshal form")
// 			}
// 			req, err := http.NewRequest(http.MethodPost, "/api/provider-platforms/{id}/map-user/{user_id}", bytes.NewBuffer(jsonForm))
// 			if err != nil {
// 				t.Fatal(err)
// 			}
// 			fmt.Println(importUserMap["id"])
// 			fmt.Println(importUserMap["user_id"])
// 			req.SetPathValue("id", fmt.Sprintf("%d", importUserMap["id"]))
// 			req.SetPathValue("user_id", fmt.Sprintf("%d", importUserMap["user_id"]))
// 			handler := getHandlerByRoleWithMiddleware(server.handleMapProviderUser, test.role)
// 			rr := executeRequest(t, req, handler, test)
// 			if test.expectedStatusCode == http.StatusCreated {
// 				received := rr.Body.String()
// 				data := models.Resource[models.ProviderUserMapping]{}
// 				if err := json.Unmarshal([]byte(received), &data); err != nil {
// 					t.Errorf("failed to unmarshal response error is %v", err)
// 				}
// 				userMapping := &models.ProviderUserMapping{}
// 				if err := server.Db.First(userMapping, data.Data.ID).Error; err != nil {
// 					t.Error("unable to get provider user mapping from db, error is ", err)
// 				}
// 				t.Cleanup(func() {
// 					err := server.Db.Delete(&models.ProviderUserMapping{}, data.Data.ID).Error
// 					if err != nil {
// 						fmt.Println("error running clean for provider user mapping that was created, error is ", err)
// 					}
// 				})
// 				if diff := cmp.Diff(userMapping, &data.Data); diff != "" {
// 					t.Errorf("handler returned unexpected results: %v", diff)
// 				}
// 			}
// 		})
// 	}
// }

func TestHandleImportUsers(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminCanImportUsers", "admin", map[string]any{"id": "5", "message": "Users imported successfully"}, http.StatusBadRequest, ""},
		{"TestUserCanImportUsers", "student", map[string]any{"message": "Users imported successfully"}, http.StatusBadRequest, "Users imported successfully"},
		// {"TestAdminCanImportUsers", "admin", map[string]any{"message": "Users imported successfully"}, http.StatusOK, ""},
		// {"TestUserCanImportUsers", "student", map[string]any{"message": "Users imported successfully"}, http.StatusOK, "Users imported successfully"},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodPost, "/api/actions/provider-platforms/{id}/import-users", nil)
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleImportUsers, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}

				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal response error is %v", err)
				}

				if data.Message != "Users imported successfully" {
					t.Errorf("handler returned wrong body: got %v want %v", data.Message, test.mapKeyValues["message"])
				}
			}
		})
	}
}

func TestHandleGetUsers(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetUsersAsAdmin", "admin", map[string]any{"id": "1"}, http.StatusOK, "?clear_cache=false&search"},
		{"TestGetUsersAsUser", "student", map[string]any{"id": "4"}, http.StatusOK, "?clear_cache=false&search"},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/actions/provider-platforms/{id}/get-users", nil)
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleGetUsers, test.role)
			rr := executeRequest(t, req, handler, test)
			received := rr.Body.String()
			if test.expectedStatusCode == http.StatusOK {
				data := models.PaginatedResource[models.ImportUser]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal import users")
				}
				//do more here
			}
		})
	}
}
