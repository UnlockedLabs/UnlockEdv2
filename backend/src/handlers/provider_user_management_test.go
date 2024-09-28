package handlers

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"slices"
	"strconv"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestHandleMapProviderUser(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminCanMapProviderUser", "admin", getImportUserWithIdsForm(), http.StatusCreated, ""},
		{"TestUserCannotMapProviderUser", "student", getImportUserWithIdsForm(), http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			importUserMap := test.mapKeyValues
			if importUserMap["err"] != nil {
				t.Fatal("unable to import user form, error is ", importUserMap["err"])
			}
			jsonForm, err := json.Marshal(importUserMap)
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPost, "/api/provider-platforms/{id}/map-user/{user_id}", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", importUserMap["id"]))
			req.SetPathValue("user_id", fmt.Sprintf("%d", importUserMap["user_id"]))
			handler := getHandlerByRoleWithMiddleware(server.handleMapProviderUser, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusCreated {
				received := rr.Body.String()
				data := models.Resource[models.ProviderUserMapping]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				userMapping := &models.ProviderUserMapping{}
				if err := server.Db.First(userMapping, data.Data.ID).Error; err != nil {
					t.Error("unable to get provider user mapping from db, error is ", err)
				}
				t.Cleanup(func() {
					err := server.Db.Delete(&models.ProviderUserMapping{}, data.Data.ID).Error
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

func TestHandleImportProviderUsers(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminCanImportProviderUsers", "admin", getImportUsersWithIdsForm(), http.StatusOK, ""},
		{"TestUserCannotImportProviderUsers", "student", getImportUsersWithIdsForm(), http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			importUsersMap := test.mapKeyValues
			if importUsersMap["err"] != nil {
				t.Fatalf("unable to import users form, error is %v", importUsersMap["err"])
			}
			jsonForm, err := json.Marshal(importUsersMap)
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPost, "/api/provider-platforms/{id}/users/import", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", importUsersMap["id"]))
			handler := getHandlerByRoleWithMiddleware(server.handleImportProviderUsers, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				received := rr.Body.String()
				data := models.Resource[[]ImportUserResponse]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				for _, importUser := range importUsersMap["users"].([]models.ImportUser) {
					if !slices.ContainsFunc(data.Data, func(userResponse ImportUserResponse) bool {
						return userResponse.Username == importUser.Username && userResponse.Error == ""
					}) {
						t.Error("import users responses not found, out of sync")
					}
				}
				var user models.User
				var mapping models.ProviderUserMapping
				for _, importUser := range importUsersMap["users"].([]models.ImportUser) {
					err := server.Db.Model(models.User{}).Where("users.username = ?", importUser.ExternalUsername).Find(&user).Error
					if err != nil { //just cleanup not an error so just logging messages to console
						fmt.Println("unable to get users that were created for clean up, error is ", err)
					}
					err = server.Db.Model(models.ProviderUserMapping{}).Where("external_username = ?", importUser.ExternalUsername).Find(&mapping).Error
					if err != nil {
						fmt.Println("unable to get provider user mappings that were created for clean up, error is ", err)
					}
					if err := server.Db.Delete(&models.ProviderUserMapping{}, mapping.ID).Error; err != nil {
						fmt.Println("unable to delete provider user mapping during cleanup, error is ", err)
					}
					if err := server.Db.Delete(&models.User{}, user.ID).Error; err != nil {
						fmt.Println("unable to delete user during cleanup, error is ", err)
					}
				}
			}
		})
	}
}

func TestHandleCreateProviderUserAccountUserMgmt(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotCreateProviderUserAccount", "student", getProviderPlatformIdAndUserId(), http.StatusUnauthorized, ""},
		{"TestAdminCanCreateProviderUserAccount", "admin", getProviderPlatformIdAndUserId(), http.StatusCreated, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodPost, "/api/provider-platforms/{id}/create-user/{user_id}", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", test.mapKeyValues["id"].(uint)))
			req.SetPathValue("user_id", fmt.Sprintf("%d", test.mapKeyValues["user_id"].(uint)))
			handler := getHandlerByRoleWithMiddleware(server.handleCreateProviderUserAccount, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if data.Message != "User created successfully" {
					t.Errorf("handler returned wrong body: got %v want %v", data.Message, "User created successfully")
				}
			}
		})
	}
}

func getImportUsersWithIdsForm() map[string]any {
	form := make(map[string]any)
	_, platforms, err := server.Db.GetAllProviderPlatforms(1, 10)
	if err != nil {
		form["err"] = err
	}
	importUsers := []models.ImportUser{}
	userNames := []string{"ShadowFox", "NovaBlaze", "IronWraith"}
	userEmails := []string{"lucas.thompson@email.com", "maya.rivera@email.com", "ethan.patel@email.com"}
	userFirstNms := []string{"Lucas", "Maya", "Ethan"}
	userLastNms := []string{"Thompson", "Rivera", "Patel"}
	for idx, name := range userNames {
		importUsers = append(importUsers, models.ImportUser{
			Username:       name,
			NameFirst:      userFirstNms[idx],
			NameLast:       userLastNms[idx],
			Email:          userEmails[idx],
			ExternalUserID: strconv.Itoa(rand.Intn(10000)),
		})
	}
	form["id"] = platforms[rand.Intn(len(platforms))].ID
	form["users"] = importUsers
	return form
}

func getImportUserWithIdsForm() map[string]any {
	form := make(map[string]any)
	form["user_id"] = uint(5)
	form["id"] = uint(8)
	form["external_user_id"] = strconv.Itoa(rand.Intn(10000))
	form["type"] = "assignment_submission"
	form["external_username"] = "BillDance05"
	return form
}

func getProviderPlatformIdAndUserId() map[string]any {
	form := make(map[string]any)
	_, platforms, err := server.Db.GetAllProviderPlatforms(1, 10)
	if err != nil {
		form["err"] = err
	}
	_, users, err := server.Db.GetCurrentUsers(1, 10, 1, "", "", "")
	if err != nil {
		form["err"] = err
	}

	form["user_id"] = users[rand.Intn(len(users))].ID
	form["id"] = platforms[rand.Intn(len(platforms))].ID
	return form
}
