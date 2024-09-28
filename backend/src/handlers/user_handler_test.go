package handlers

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestHandleIndexUsers(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetUsersAsAdmin", "admin", getDBUsersAsUser(), http.StatusOK, ""},
		{"TestGetUsersAsUser", "student", getDBUsersWithLogins(), http.StatusUnauthorized, ""},
		{"TestGetUsersWithLogins", "admin", getDBUsersWithLogins(), http.StatusOK, "?include=logins"},
		{"TestGetUnmappedUsers", "admin", getDBUnmappedUsers(), http.StatusOK, "?include=only_unmapped&provider_id=1"},
		{"TestAssertFacilityContext", "admin", getDBUsers(), http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			if test.mapKeyValues["dbErr"] != nil {
				t.Fatalf("unable to get users from db, error is %v", test.mapKeyValues["dbErr"])
			}
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/users%s", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handleIndexUsers, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				if test.mapKeyValues["dbUsers"] != nil {
					respUsers := models.PaginatedResource[models.User]{}
					if err := json.NewDecoder(rr.Body).Decode(&respUsers); err != nil {
						t.Errorf("unable to get users from db, error is %v", err)
					}
					for _, user := range respUsers.Data {
						if slices.ContainsFunc(test.mapKeyValues["dbUsers"].([]models.User), func(other models.User) bool {
							return user.Username == other.Username
						}) {
							t.Error("user found in multiple facility contexts")
						}
					}
					return
				}
				Response := models.PaginatedResource[models.User]{
					Meta: models.PaginationMeta{
						CurrentPage: 1,
						PerPage:     10,
						Total:       test.mapKeyValues["total"].(int64),
						LastPage:    1,
					},
				}
				data := models.PaginatedResource[models.User]{}
				received := rr.Body.String()
				if err = json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal response, error is %v", err)
				}
				if data.Meta.Total != Response.Meta.Total {
					t.Errorf("handler returned unexpected body: got %v want %v", data.Meta.Total, Response.Meta.Total)
				}
				if len(data.Data) != int(test.mapKeyValues["total"].(int64)) {
					t.Errorf("handler returned users from the wrong facility context")
				}
			}
		})
	}
}

func TestHandleShowUser(t *testing.T) {
	httpTests := []httpTest{
		{"TestNonAdminCanViewThemselves", "student", map[string]any{"id": "4"}, http.StatusOK, ""},
		{"TestNonAdminCannotViewAnotherUser", "student", map[string]any{"id": "2"}, http.StatusUnauthorized, ""},
		{"TestAdminUserCanViewThemselves", "admin", map[string]any{"id": "1"}, http.StatusOK, ""},
		{"TestAdminUserCanViewOthers", "admin", map[string]any{"id": "4"}, http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/users", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleShowUser, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				id, _ := strconv.Atoi(test.mapKeyValues["id"].(string))
				user, err := server.Db.GetUserByID(uint(id))
				if err != nil {
					t.Fatalf("unable to get user from db, error is %v", err)
					return
				}
				received := rr.Body.String()
				resource := models.Resource[models.User]{}
				if err := json.Unmarshal([]byte(received), &resource); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if diff := cmp.Diff(user, &resource.Data); diff != "" {
					t.Errorf("handler returned unexpected response body: %v", diff)
				}
			}
		})
	}
}

func TestCreateUser(t *testing.T) {
	httpTests := []httpTest{
		{"TestNonAdminCannotCreateUser", "student", getNewUserForm(), http.StatusUnauthorized, ""},
		{"TestAdminCanCreateUser", "admin", getNewUserForm(), http.StatusCreated, ""},
		{"TestAdminCreateUserNameValidationFailed", "admin", getBadUserWithNoNameForm(), http.StatusBadRequest, ""},
		{"TestAdminCreateUserNameExits", "admin", getUserWhereNameExistsAlreadyForm(), http.StatusBadRequest, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			request := map[string]interface{}{}
			request["user"] = test.mapKeyValues
			request["providers"] = []int{}
			jsonForm, err := json.Marshal(request)
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPost, "/api/users", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handleCreateUser, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusCreated {
				defer t.Cleanup(cleanupAddedUser)
				user, err := server.Db.GetUserByUsername("test")
				if err != nil {
					t.Fatalf("unable to get user from db, error is %v", err)
				}
				received := rr.Body.String()
				resource := models.Resource[NewUserResponse]{}
				if err := json.Unmarshal([]byte(received), &resource); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if diff := cmp.Diff(user, &resource.Data.User); diff != "" {
					t.Errorf("handler returned unexpected results: %v", diff)
				}
			}
		})
	}
}

func TestUpdateUser(t *testing.T) {
	httpTests := []httpTest{
		{"TestNonAdminCannotUpdateUser", "student", getUpdateUserForm(), http.StatusUnauthorized, ""},
		{"TestAdminCanUpdateUser", "admin", getUpdateUserForm(), http.StatusOK, ""},
		{"TestAdminUpdateUserNameValidationFailed", "admin", getBadUserWithNoNameForm(), http.StatusBadRequest, ""},
		{"TestAdminUpdateUserNameExits", "admin", getUserWhereNameExistsAlreadyForm(), http.StatusBadRequest, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			newUser := models.User{
				NameFirst:  "testUser",
				NameLast:   "testUser",
				Username:   "testUser",
				Email:      "testUser",
				Role:       "admin",
				FacilityID: 1,
			}
			var id uint
			if test.expectedStatusCode == http.StatusOK {
				created, err := server.Db.CreateUser(&newUser)
				if err != nil {
					t.Errorf("unable to create user, error is %v", err)
				}
				id = created.ID
				t.Cleanup(func() {
					if err := server.Db.DeleteUser(int(id)); err != nil {
						fmt.Printf("unable to cleanup/delete user. Error is: %v", err)
					}
				})
			} else {
				id = 1
			}
			jsonForm, err := json.Marshal(test.mapKeyValues)
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPatch, "/api/users/", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleUpdateUser, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				user, err := server.Db.GetUserByUsername(test.mapKeyValues["username"].(string))
				if err != nil {
					t.Fatalf("unable to get user from db, error is %v", err)
				}
				received := rr.Body.String()
				resource := models.Resource[models.User]{}
				if err := json.Unmarshal([]byte(received), &resource); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if diff := cmp.Diff(user, &resource.Data); diff != "" {
					t.Errorf("handler returned unexpected results: %v", diff)
				}
			}
		})
	}
}

func TestDeleteUser(t *testing.T) {
	httpTests := []httpTest{
		{"TestNonAdminCannotDeleteUser", "student", nil, http.StatusUnauthorized, ""},
		{"TestAdminCanDeleteUser", "admin", map[string]any{"message": "User deleted successfully"}, http.StatusNoContent, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			newUser := models.User{
				NameFirst:  "testUser",
				NameLast:   "testUser",
				Username:   "testUser",
				Email:      "testUser",
				Role:       "admin",
				FacilityID: 1,
			}
			var id uint
			if test.expectedStatusCode == http.StatusNoContent {
				created, err := server.Db.CreateUser(&newUser)
				if err != nil {
					t.Fatalf("unable to create user, error is %v", err)
				}
				id = created.ID
			} else {
				id = 1
			}
			req, err := http.NewRequest(http.MethodDelete, "/api/users/", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleDeleteUser, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusNoContent {
				received := rr.Body.String()
				resource := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &resource); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if resource.Message != test.mapKeyValues["message"] {
					t.Errorf("handler returned wrong body: got %v want %v", resource.Message, test.mapKeyValues["message"])
				}
			}
		})
	}
}

func TestResetStudentPassword(t *testing.T) {
	httpTests := []httpTest{
		{"TestNonAdminCannotResetStudentPassword", "student", nil, http.StatusUnauthorized, ""},
		{"TestAdminCanResetStudentPassword", "admin", map[string]any{"message": "Temporary password assigned"}, http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			form := map[string]uint{"user_id": uint(5)}
			jsonForm, err := json.Marshal(form)
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPost, "/api/users/student-password", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handleResetStudentPassword, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				received := rr.Body.String()
				resource := models.Resource[map[string]string]{}
				if err := json.Unmarshal([]byte(received), &resource); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if resource.Data["message"] != test.mapKeyValues["message"] {
					t.Errorf("handler returned wrong body: got %v want %v", resource.Data["message"], test.mapKeyValues["message"])
				}
			}
		})
	}
}

func cleanupAddedUser() {
	user, err := server.Db.GetUserByUsername("test")
	if err != nil {
		fmt.Println("unable to get user by username test. Error is: ", err)
	}
	if err := server.Db.DeleteUser(int(user.ID)); err != nil {
		fmt.Println("unable to remove user. Error is: ", err)
	}
}
func getDBUsersAsUser() map[string]any {
	total, _, dbErr := server.Db.GetCurrentUsers(1, 10, 1, "", "", "")
	form := make(map[string]any)
	form["total"] = total
	form["dbErr"] = dbErr
	return form
}

func getDBUsersWithLogins() map[string]any {
	total, _, dbErr := server.Db.GetUsersWithLogins(1, 10, 1)
	form := make(map[string]any)
	form["total"] = total
	form["dbErr"] = dbErr
	return form
}

func getDBUnmappedUsers() map[string]any {
	total, _, dbErr := server.Db.GetUnmappedUsers(1, 10, "1", nil, 1)
	form := make(map[string]any)
	form["total"] = total
	form["dbErr"] = dbErr
	return form
}

func getDBUsers() map[string]any {
	total, dbUsers, dbErr := server.Db.GetCurrentUsers(1, 10, 2, "", "", "")
	form := make(map[string]any)
	form["dbUsers"] = dbUsers
	form["dbErr"] = dbErr
	form["total"] = total
	return form
}

func getNewUserForm() map[string]any {
	form := make(map[string]any)
	form["username"] = "test"
	form["name_first"] = "test"
	form["name_last"] = "test"
	form["email"] = "test"
	form["role"] = "admin"
	return form
}

func getUserWhereNameExistsAlreadyForm() map[string]any {
	form := make(map[string]any)
	form["username"] = "darlafragle13"
	form["name_first"] = "test"
	form["name_last"] = "test"
	form["email"] = "test"
	form["role"] = "admin"
	return form
}

func getBadUserWithNoNameForm() map[string]any {
	form := make(map[string]any)
	form["username"] = ""
	form["name_first"] = ""
	form["name_last"] = "test"
	form["email"] = "test"
	form["role"] = "admin"
	return form
}

func getUpdateUserForm() map[string]any {
	form := make(map[string]any)
	form["username"] = "testUpdate"
	form["name_first"] = "testUpdate"
	form["name_last"] = "testUpdate"
	form["email"] = "testUpdate"
	form["role"] = "admin"
	return form
}
