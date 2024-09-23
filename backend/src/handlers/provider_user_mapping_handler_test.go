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
	"golang.org/x/exp/rand"
)

func TestHandleGetMappingsForUser(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetMappingsForUserAsAdmin", "admin", map[string]any{"id": "2"}, http.StatusOK, ""},
		{"TestGetMappingsForUserAsUser", "student", map[string]any{"id": "2"}, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/users/{id}/logins", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRoleWithMiddleware(server.handleGetMappingsForUser, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				id, _ := strconv.Atoi(test.mapKeyValues["id"].(string))
				mappings, err := server.Db.GetAllProviderMappingsForUser(id)
				if err != nil {
					t.Errorf("failed to retrieve mappings for user, error is %v", err)
				}
				data := models.Resource[[]models.ProviderUserMapping]{}
				received := rr.Body.String()
				if err = json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				for _, mapping := range mappings {
					if !slices.ContainsFunc(data.Data, func(prMap models.ProviderUserMapping) bool {
						return prMap.ID == mapping.ID
					}) {
						t.Error("provider user mappings not found, out of sync")
					}
				}
			}
		})
	}
}

func TestHandleCreateProviderUserMapping(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotCreateProviderUserMapping", "student", nil, http.StatusUnauthorized, ""},
		{"TestAdminCanCreateProviderUserMapping", "admin", nil, http.StatusCreated, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			form, err := getProviderUserMapping()
			if err != nil {
				t.Fatalf("unable to initialize user mapping form, error is %v", err)
			}
			jsonForm, err := json.Marshal(form)
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPost, "/api/users/{id}/logins", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			t.Cleanup(func() {
				err := server.Db.DeleteUser(int(form["user_id"].(uint)))
				if err != nil {
					fmt.Println("error during cleanup/delete of user, error is ", err)
				}
			})
			req.SetPathValue("id", fmt.Sprintf("%d", int(form["user_id"].(uint))))
			handler := getHandlerByRoleWithMiddleware(server.handleCreateProviderUserMapping, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusCreated {
				received := rr.Body.String()
				data := models.Resource[models.ProviderUserMapping]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				userMapping, err := server.Db.GetProviderUserMapping(int(data.Data.UserID), int(data.Data.ProviderPlatformID))
				if err != nil {
					t.Fatalf("unable to get provider user mapping from db, error is %v", err)
				}
				t.Cleanup(func() {
					err := server.Db.DeleteProviderUserMappingByUserID(int(data.Data.UserID), int(data.Data.ProviderPlatformID))
					if err != nil {
						fmt.Println("unable to cleanup/delete provider user mapping, error is ", err)
					}
				})
				if diff := cmp.Diff(userMapping, &data.Data); diff != "" {
					t.Errorf("handler returned unexpected results: %v", diff)
				}
			}
		})
	}
}

func TestHandleCreateProviderUserAccount(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotCreateProviderUserAccount", "student", map[string]any{"id": "2", "user_id": "4"}, http.StatusUnauthorized, ""},
		{"TestAdminCanCreateProviderUserAccount", "admin", map[string]any{"id": "2", "user_id": "4", "message": "User created successfully"}, http.StatusCreated, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodPost, "/api/provider-platforms/{id}/user-accounts/{user_id}", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			req.SetPathValue("user_id", test.mapKeyValues["user_id"].(string))
			handler := getHandlerByRoleWithMiddleware(server.handleCreateProviderUserAccount, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusCreated {
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

func TestHandleDeleteProviderUserMapping(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotDeleteProviderUserMapping", "student", nil, http.StatusUnauthorized, ""},
		{"TestAdminCanDeleteProviderUserMapping", "admin", map[string]any{"message": "Mapping deleted successfully"}, http.StatusNoContent, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			var userId uint
			var providerId uint
			if test.expectedStatusCode == http.StatusNoContent {
				mapping, err := createProviderUserMapping()
				if err != nil {
					t.Fatalf("unable to create provider user mapping, error is %v", err)
				}
				userId = mapping.UserID
				providerId = mapping.ProviderPlatformID
			} else {
				userId = 1
				providerId = 2
			}
			req, err := http.NewRequest(http.MethodDelete, "/api/users/{userId}/logins/{providerId}", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("userId", fmt.Sprintf("%d", userId))
			req.SetPathValue("providerId", fmt.Sprintf("%d", providerId))
			handler := getHandlerByRoleWithMiddleware(server.handleDeleteProviderUserMapping, test.role)
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

func createUser() (*models.User, error) {
	newUser := models.User{
		NameFirst:  "UserWithProviderMapping",
		NameLast:   "testUser",
		Username:   "soontobemappeduser" + strconv.Itoa(rand.Intn(25)),      // randomize the name
		Email:      "mappeduser@" + strconv.Itoa(rand.Intn(25)) + "isu.net", //randomize the email
		Role:       "student",
		FacilityID: 2,
	}
	user, err := server.Db.CreateUser(&newUser)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func createProviderUserMapping() (*models.ProviderUserMapping, error) {
	user, err := createUser()
	if err != nil {
		return nil, err
	}
	mapping := models.ProviderUserMapping{
		UserID:             user.ID,
		ProviderPlatformID: 2,
		ExternalUsername:   user.Username,
		ExternalUserID:     strconv.Itoa(int(user.ID + 5)),
	}
	err = server.Db.CreateProviderUserMapping(&mapping)
	return &mapping, err
}

func getProviderUserMapping() (map[string]interface{}, error) {
	user, err := createUser()
	if err != nil {
		return nil, err
	}
	//create user and then add user mapping
	form := make(map[string]interface{})
	form["user_id"] = user.ID
	form["provider_platform_id"] = 2 //this should always exist
	form["external_username"] = user.Username
	form["external_user_id"] = strconv.Itoa(int(user.ID + 5)) //just some random number here
	return form, nil
}
