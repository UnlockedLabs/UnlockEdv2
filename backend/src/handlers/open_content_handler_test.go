package handlers

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
)

func TestHandleIndexOpenContent(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetOpenContentAsAdmin", "admin", map[string]any{"all": false}, http.StatusOK, "?all=false"},
		{"TestGetOpentContentAsUser", "student", map[string]any{"all": false}, http.StatusOK, "?all=false"},
		{"TestGetAllOpenContentAsAdmin", "admin", map[string]any{"all": true}, http.StatusOK, "?all=true"},
		{"TestGetAllOpentContentAsUser", "student", map[string]any{"all": true}, http.StatusOK, "?all=true"},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/open-content%v", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRole(server.handleIndexOpenContent, test.role)
			rr := executeRequest(t, req, handler, test)
			contents, err := server.Db.GetOpenContent(test.mapKeyValues["all"].(bool))
			if err != nil {
				t.Fatalf("unable to get open content, error is %v", err)
			}
			data := models.PaginatedResource[models.OpenContentProvider]{}
			received := rr.Body.String()
			if err = json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("failed to unmarshal resource, error is %v", err)
			}
			for _, openContent := range contents {
				if !slices.ContainsFunc(data.Data, func(content models.OpenContentProvider) bool {
					return content.ID == openContent.ID
				}) {
					t.Error("open content not found, out of sync")
				}
			}
		})
	}
}

func TestHandleToggleOpenContent(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotToggleOpenContent", "student", map[string]any{"id": "2"}, http.StatusUnauthorized, ""},
		{"TestAdminCanToggleOpenContent", "admin", map[string]any{"id": "2", "message": "Content provider toggled successfully"}, http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodPut, "/api/open-content/", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRoleWithMiddleware(server.handleToggleOpenContent, test.role)
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
				//special case here, execute another request to toggle the open content
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

func TestHandleCreateOpenContent(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminCanCreateOpenContent", "admin", getNewOpenContent(), http.StatusCreated, ""},
		{"TestUserCannotCreateOpenContent", "student", getNewOpenContent(), http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			openContentMap := test.mapKeyValues
			if openContentMap["err"] != nil {
				t.Fatalf("unable to create new open content, error is %v", openContentMap["err"])
			}
			jsonForm, err := json.Marshal(openContentMap)
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPost, "/api/open-content", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handleCreateOpenContent, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusCreated {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if data.Message != "Content provider created successfully" {
					t.Errorf("handler returned wrong body: got %v want %v", data.Message, "Content provider created successfully")
				}
				content := &models.OpenContentProvider{}
				if err := server.Db.Where("description = ?", test.mapKeyValues["description"].(string)).First(&content).Error; err != nil {
					t.Errorf("error getting open content provider from db, error is %v", err)
				}
				t.Cleanup(func() {
					err := server.Db.Delete(&models.OpenContentProvider{}, content.ID).Error
					if err != nil {
						fmt.Println("unable to clean/delete open content, error is ", err)
					}
				})
			}
		})
	}
}

func getNewOpenContent() map[string]any {
	_, providers, err := server.Db.GetAllProviderPlatforms(1, 10)
	form := make(map[string]any)
	form["err"] = err
	form["url"] = "http://www.jenkins.com/super-impedit-quasi-esse-eum-temporibus-autem.html"
	form["thumbnail_url"] = "http://www.jenkins.com/super-impedit-quasi-esse-eum-temporibus-autem.html"
	form["linked_provider_id"] = providers[rand.Intn(len(providers))].ID
	form["description"] = "Content that can be freely used, shared, and modified."
	return form
}
func TestHandleToggleFavoriteOpenContent(t *testing.T) {
	httpTests := []httpTest{{
		"TestUserCanFavoriteOpenContent",
		"student",
		map[string]any{
			"content_id":               "1",
			"open_content_provider_id": 3,
			"name":                     "Python Documentation",
			"content_url":              "/api/proxy/libraries/1",
			"message":                  "Favorite toggled successfully",
		},
		http.StatusOK, "",
	},
		{
			"TestUserUnfavoriteOpenContent",
			"student",
			map[string]any{
				"content_id":               "1",
				"open_content_provider_id": 3,
				"name":                     "Python Documentation",
				"content_url":              "/api/proxy/libraries/1",
				"message":                  "Favorite toggled successfully",
			},
			http.StatusOK, "",
		},
	}

	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			reqBody := map[string]any{
				"open_content_provider_id": test.mapKeyValues["open_content_provider_id"],
				"name":                     test.mapKeyValues["name"],
				"content_url":              test.mapKeyValues["content_url"],
			}
			reqBodyJSON, err := json.Marshal(reqBody)
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}

			req, err := http.NewRequest(http.MethodPut, "/api/open-content/{id}/save", bytes.NewBuffer(reqBodyJSON))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}

			req.SetPathValue("id", test.mapKeyValues["content_id"].(string))
			req.Header.Set("Content-Type", "application/json")

			handler := getHandlerByRole(server.handleToggleFavoriteOpenContent, test.role)
			rr := executeRequest(t, req, handler, test)
			if rr.Code != test.expectedStatusCode {
				t.Errorf("handler returned wrong status code: got %v want %v", rr.Code, test.expectedStatusCode)
			}
			if test.expectedStatusCode == http.StatusOK {
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

func TestHandleToggleFeaturedOpenContent(t *testing.T) {
	httpTests := []httpTest{{
		"TestUserCanFavoriteOpenContent",
		"admin",
		map[string]any{
			"content_id":               "1",
			"open_content_provider_id": 3,
			"name":                     "Python Documentation",
			"content_url":              "/api/proxy/libraries/1",
			"message":                  "Favorite toggled successfully",
			"facility_id":              uint(1),
		},
		http.StatusOK, "",
	},
		{
			"TestUserUnfavoriteOpenContent",
			"admin",
			map[string]any{
				"content_id":               "1",
				"open_content_provider_id": 3,
				"name":                     "Python Documentation",
				"content_url":              "/api/proxy/libraries/1",
				"message":                  "Favorite toggled successfully",
				"facility_id":              uint(1),
			},
			http.StatusOK, "",
		},
	}

	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			reqBody := map[string]any{
				"open_content_provider_id": test.mapKeyValues["open_content_provider_id"],
				"name":                     test.mapKeyValues["name"],
				"content_url":              test.mapKeyValues["content_url"],
			}
			reqBodyJSON, err := json.Marshal(reqBody)
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}

			req, err := http.NewRequest(http.MethodPut, "/api/open-content/{id}/feature", bytes.NewBuffer(reqBodyJSON))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}

			req.SetPathValue("id", test.mapKeyValues["content_id"].(string))
			req.Header.Set("Content-Type", "application/json")

			handler := getHandlerByRole(server.handleToggleFavoriteOpenContent, test.role)
			rr := executeRequest(t, req, handler, test)
			if rr.Code != test.expectedStatusCode {
				t.Errorf("handler returned wrong status code: got %v want %v", rr.Code, test.expectedStatusCode)
			}
			if test.expectedStatusCode == http.StatusOK {
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

func TestHandleGetUserFavoriteOpenContent(t *testing.T) {
	httpTests := []httpTest{
		{
			"TestGetFavoritesForStudentUser",
			"student",
			map[string]any{"user_id": uint(4), "page": 1, "per_page": 10},
			http.StatusOK,
			"?page=1&per_page=10",
		},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/open-content/favorites%v", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}

			handler := getHandlerByRole(server.handleGetUserFavoriteOpenContent, test.role)
			rr := executeRequest(t, req, handler, test)
			if rr.Code != test.expectedStatusCode {
				t.Fatalf("handler returned wrong status code: got %v want %v", rr.Code, test.expectedStatusCode)
			}
			if test.expectedStatusCode == http.StatusOK {
				_, expectedFavorites, err := server.Db.GetUserFavorites(test.mapKeyValues["user_id"].(uint), test.mapKeyValues["page"].(int), test.mapKeyValues["per_page"].(int))
				if err != nil {
					t.Fatalf("unable to get user favorites, error is %v", err)
				}

				data := models.PaginatedResource[models.OpenContentFavorite]{}
				received := rr.Body.String()
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}

				if len(data.Data) != len(expectedFavorites) {
					t.Errorf("handler returned wrong number of favorites: got %v want %v", len(data.Data), len(expectedFavorites))
				}
				for _, expectedFav := range expectedFavorites {
					if !slices.ContainsFunc(data.Data, func(fav models.OpenContentFavorite) bool {
						return fav.ID == expectedFav.ID
					}) {
						t.Errorf("favorite not found in response: %+v", expectedFav)
					}
				}
			}
		})
	}
}

func TestHandleGetFacilityFeaturedOpenContent(t *testing.T) {
	httpTests := []httpTest{
		{
			"TestHandleGetFacilityFeaturedOpenContent",
			"student",
			map[string]any{"user_id": uint(4), "facility_id": uint(1), "page": 1, "per_page": 10},
			http.StatusOK,
			"?page=1&per_page=10",
		},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/open-content/featured%v", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRole(server.handleGetFacilityFeaturedOpenContent, test.role)
			rr := executeRequest(t, req, handler, test)
			if rr.Code != test.expectedStatusCode {
				t.Fatalf("handler returned wrong status code: got %v want %v", rr.Code, test.expectedStatusCode)
			}
			if test.expectedStatusCode == http.StatusOK {
				_, expectedFeatured, err := server.Db.GetFacilityFeaturedOpenContent(test.mapKeyValues["facility_id"].(uint), test.mapKeyValues["page"].(int), test.mapKeyValues["per_page"].(int))
				if err != nil {
					t.Fatalf("unable to get user favorites, error is %v", err)
				}

				data := models.PaginatedResource[models.OpenContentFavorite]{}
				received := rr.Body.String()
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}

				if len(data.Data) != len(expectedFeatured) {
					t.Errorf("handler returned wrong number of favorites: got %v want %v", len(data.Data), len(expectedFeatured))
				}
				for _, expectedFeat := range expectedFeatured {
					if !slices.ContainsFunc(data.Data, func(fav models.OpenContentFavorite) bool {
						return fav.ID == expectedFeat.ID
					}) {
						t.Errorf("favorite not found in response: %+v", expectedFeat)
					}
				}
			}
		})
	}
}
