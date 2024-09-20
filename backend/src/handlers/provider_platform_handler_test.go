package handlers

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
)

func TestHandleIndexProviders(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetProviderPlatformsAsAdmin", "admin", nil, http.StatusOK, ""},
		{"TestGetProviderPlatformsAsUser", "student", nil, http.StatusUnauthorized, ""},
		{"TestGetProviderPlatformsOIDC", "admin", nil, http.StatusOK, "?only=oidc_enabled"},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/provider-platforms%s", test.queryParams), nil)
			if err != nil {
				t.Fatal(err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handleIndexProviders, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				total, platforms, err := server.Db.GetAllProviderPlatforms(1, 10)
				if err != nil {
					t.Errorf("failed to get provider platforms from db")
				}
				if strings.Contains(test.queryParams, "oidc_enabled") {
					platforms = slices.DeleteFunc(platforms, func(platform models.ProviderPlatform) bool {
						return platform.OidcID == 0 || platform.Type == models.Kolibri
					})
					total = int64(len(platforms)) //reset total for filtered out oidc_enabled
				}
				data := models.PaginatedResource[models.ProviderPlatform]{}
				received := rr.Body.String()
				if err = json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal response error is %v", err)
				}
				if data.Meta.Total != total {
					t.Errorf("handler returned unexpected total returned: got %v want %v", data.Meta.Total, total)
				}
				for _, platform := range platforms {
					if !slices.ContainsFunc(data.Data, func(plat models.ProviderPlatform) bool {
						return plat.ID == platform.ID
					}) {
						t.Error("platforms not found, out of sync")
					}
				}
			}
		})
	}
}

func TestHandleShowProvider(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminCanViewPlatformProvider", "admin", map[string]any{"id": "4"}, http.StatusOK, ""},
		{"TestUserCannotViewPlatformProvider", "student", map[string]any{"id": "4"}, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/provider-platforms/", nil)
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRoleWithMiddleware(server.handleShowProvider, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				id, _ := strconv.Atoi(test.mapKeyValues["id"].(string))
				platform, err := server.Db.GetProviderPlatformByID(id)
				if err != nil {
					t.Fatal(err)
					return
				}
				received := rr.Body.String()
				data := models.Resource[models.ProviderPlatform]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal provider platform")
				}
				if diff := cmp.Diff(platform, &data.Data); diff != "" {
					t.Errorf("handler returned unexpected response body: %v", diff)
				}
			}
		})
	}
}

func TestHandleCreateProvider(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotCreatePlatformProvider", "student", getProviderPlatform(), http.StatusUnauthorized, ""},
		{"TestAdminCanCreatePlatformProvider", "admin", getProviderPlatform(), http.StatusCreated, ""},
		{"TestAdminCanCreateKolibriTypePlatformProvider", "admin", getKolibrTypeProviderPlatform(), http.StatusCreated, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			jsonForm, err := json.Marshal(test.mapKeyValues)
			if err != nil {
				t.Errorf("failed to marshal form")
			}
			req, err := http.NewRequest(http.MethodPost, "/api/provider-platforms", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatal(err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handleCreateProvider, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusCreated {
				received := rr.Body.String()
				data := models.Resource[models.ProviderPlatform]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal provider platform")
				}
				providerPlatform, err := server.Db.GetProviderPlatformByID(int(data.Data.ID))
				if err != nil {
					t.Fatal(err)
				}
				t.Cleanup(func() {
					err := server.Db.DeleteProviderPlatform(int(providerPlatform.ID))
					if err != nil {
						fmt.Println(err)
					}
				})
				if diff := cmp.Diff(providerPlatform, &data.Data, cmpopts.IgnoreFields(models.ProviderPlatform{}, "AccessKey")); diff != "" {
					t.Errorf("handler returned unexpected results: %v", diff)
				}
			}
		})
	}
}

func TestHandleUpdateProvider(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminCanUpdateFacility", "admin", getProviderPlatform(), http.StatusOK, ""},
		{"TestUserCannotUpdateFacility", "student", nil, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			createPlat := getUpdateDeleteProvider()
			var id uint
			if test.expectedStatusCode == http.StatusOK {
				newPlat, err := server.Db.CreateProviderPlatform(&createPlat)
				if err != nil {
					t.Errorf("failed to create platform provider")
				}
				id = newPlat.ID
				t.Cleanup(func() {
					if err := server.Db.DeleteProviderPlatform(int(id)); err != nil {
						fmt.Println("Unable to delete provider platform. Error is: ", err)
					}
				})
			} else {
				id = 1
			}
			jsonForm, err := json.Marshal(test.mapKeyValues)
			if err != nil {
				t.Errorf("failed to marshal form")
			}
			req, err := http.NewRequest(http.MethodPatch, "/api/provider-platforms/", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleUpdateProvider, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				providerPlatform, err := server.Db.GetProviderPlatformByID(int(id))
				if err != nil {
					t.Fatal(err)
				}
				received := rr.Body.String()
				data := models.Resource[models.ProviderPlatform]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal user")
				}
				if diff := cmp.Diff(providerPlatform, &data.Data, cmpopts.IgnoreFields(models.ProviderPlatform{}, "AccessKey")); diff != "" {
					t.Errorf("handler returned unexpected results: %v", diff)
				}
			}
		})
	}
}

func TestHandleDeleteProvider(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotDeletePlatformProvider", "student", nil, http.StatusUnauthorized, ""},
		{"TestAdminCanDeletePlatformProvider", "admin", map[string]any{"message": "Provider platform deleted successfully"}, http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			createPlat := getUpdateDeleteProvider()
			var id uint
			if test.expectedStatusCode == http.StatusOK {
				newPlat, err := server.Db.CreateProviderPlatform(&createPlat)
				if err != nil {
					t.Errorf("failed to create provider platform")
				}
				id = newPlat.ID
			} else {
				id = 1
			}
			req, err := http.NewRequest(http.MethodDelete, " /api/provider-platforms/", nil)
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleDeleteProvider, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource message")
				}
				if data.Message != test.mapKeyValues["message"] {
					t.Errorf("handler returned wrong body: got %v want %v", data.Message, test.mapKeyValues["message"])
				}
			}
		})
	}
}

func getKolibrTypeProviderPlatform() map[string]any {
	form := make(map[string]any)
	form["type"] = "kolibri"
	form["name"] = "Super Brayan Carter"
	form["description"] = "Super aut et et aut."
	form["icon_url"] = nil
	form["account_id"] = "818359091"
	form["base_url"] = "http://www.jenkins.com/super-impedit-quasi-esse-eum-temporibus-autem.html"
	form["state"] = "enabled"
	return form
}

func getProviderPlatform() map[string]any {
	form := make(map[string]any)
	form["type"] = "super_canvas_cloud"
	form["name"] = "Super Brayan Carter"
	form["description"] = "Super aut et et aut."
	form["icon_url"] = nil
	form["account_id"] = "818359091"
	form["base_url"] = "http://www.jenkins.com/super-impedit-quasi-esse-eum-temporibus-autem.html"
	form["state"] = "enabled"
	return form
}

func getUpdateDeleteProvider() models.ProviderPlatform {
	return models.ProviderPlatform{
		Type:        "Yo_canvas_cloud",
		Name:        "Yo Brayan Carter",
		Description: "Yo aut et et aut.",
		AccountID:   "818359898",
		BaseUrl:     "http://www.jenkins.com/super-impedit-quasi-esse-eum-temporibus-autem.html",
		State:       "enabled",
	}
}
