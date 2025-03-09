package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"testing"
)

func TestHandleIndexOpenContent(t *testing.T) {
	httpTests := []httpTest{
		{"TestIndexOpenContentAsAdmin", "admin", nil, http.StatusOK, ""},
		{"TestIndexOpenContentAsUser", "student", nil, http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/open-content", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRole(server.handleIndexOpenContent, test.role)
			rr := executeRequest(t, req, handler, test)
			var all bool
			if test.role == "admin" {
				all = true
			}
			openContentProviders, err := server.Db.GetOpenContent(all)
			if err != nil {
				t.Fatalf("unable to get open content from db, error is %v", err)
			}
			data := models.Resource[[]models.OpenContentProvider]{}
			received := rr.Body.String()
			if err = json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("failed to unmarshal resource, error is %v", err)
			}
			for _, provider := range openContentProviders {
				if !slices.ContainsFunc(data.Data, func(ocProvider models.OpenContentProvider) bool {
					return ocProvider.ID == provider.ID
				}) {
					t.Error("providers not found, out of sync")
				}
			}
		})
	}
}

func TestHandleGetUserFavoriteOpenContentGroupings(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetUserFavoriteOpenContentGroupingsAsUser", "student", map[string]any{"user_id": uint(4)}, http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/open-content/favorite-groupings", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRole(server.handleGetUserFavoriteOpenContentGroupings, test.role)
			rr := executeRequest(t, req, handler, test)
			args := models.QueryContext{FacilityID: 1, UserID: test.mapKeyValues["user_id"].(uint)}
			contentItems, err := server.Db.GetUserFavoriteGroupings(&args)
			if err != nil {
				t.Fatalf("unable to get open content items from db, error is %v", err)
			}
			data := models.Resource[[]models.OpenContentItem]{}
			received := rr.Body.String()
			if err = json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("failed to unmarshal resource, error is %v", err)
			}
			for _, contentItem := range contentItems {
				if !slices.ContainsFunc(data.Data, func(item models.OpenContentItem) bool {
					return item.ContentId == contentItem.ContentId
				}) {
					t.Error("open content favorites not found, out of sync")
				}
			}
		})
	}
}

func TestHandleGetUserFavoriteOpenContent(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetUserFavoriteOpenContentUser", "student", map[string]any{"user_id": uint(4), "page": 1, "per_page": 10}, http.StatusOK, "?order_by=title&order=asc"},
	}
	search := ""
	orderBy := "title"
	order := "asc"
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/open-content/favorites%s", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRole(server.handleGetUserFavoriteOpenContent, test.role)
			rr := executeRequest(t, req, handler, test)
			args := models.QueryContext{FacilityID: 1, Page: 1, PerPage: 10, UserID: 4, Search: search, OrderBy: orderBy, Order: order}
			favorites, err := server.Db.GetUserFavorites(&args)
			if err != nil {
				t.Fatalf("unable to get user favorites from db, error is %v", err)
			}
			data := models.PaginatedResource[models.OpenContentItem]{}
			received := rr.Body.String()
			if err = json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("failed to unmarshal resource, error is %v", err)
			}
			for _, favorite := range favorites {
				if !slices.ContainsFunc(data.Data, func(item models.OpenContentItem) bool {
					return favorite.ContentId == item.ContentId
				}) {
					t.Error("favorites not found, out of sync")
				}
			}
		})
	}
}
