package handlers

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"testing"
)

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

			handler := getHandlerByRole(server.handleToggleFavoriteLibrary, test.role)
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
