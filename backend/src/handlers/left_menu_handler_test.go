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

func TestHandleGetLeftMenu(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetLeftMenuAsAdmin", "admin", map[string]any{"limit": -1}, http.StatusOK, ""},
		{"TestGetLeftMenuAsUser", "student", map[string]any{"limit": -1}, http.StatusOK, ""},
		{"TestGetLeftMenuWithLimitAsUser", "student", map[string]any{"limit": 5}, http.StatusOK, "?limit=5"},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/left-menu%v", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRole(server.handleGetLeftMenu, test.role)
			rr := executeRequest(t, req, handler, test)
			menuLinks, err := server.Db.GetLeftMenuLinks(test.mapKeyValues["limit"].(int))
			if err != nil {
				t.Fatalf("unable to retrieve menu links, error is %v", err)
			}
			data := models.Resource[[]models.LeftMenuLink]{}
			received := rr.Body.String()
			if err = json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("failed to unmarshal response error is %v", err)
			}
			for _, link := range menuLinks {
				if !slices.ContainsFunc(data.Data, func(menu models.LeftMenuLink) bool {
					return menu.Name == link.Name
				}) {
					t.Error("menu links not found, out of sync")
				}
			}
		})
	}
}

func TestHandlePostLeftMenuLinks(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminCanPostLeftMenuLinks", "admin", nil, http.StatusCreated, ""},
		{"TestUserCannotPostLeftMenuLinks", "student", nil, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			form := getNewMenuLinksForm()
			if form["err"] != nil {
				t.Error("unable to build new menu links object, error is ", form["err"])
			}
			jsonForm, err := json.Marshal(form["menuLinks"])
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPut, "/api/left-menu", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handlePostLeftMenuLinks, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusCreated {
				menuLinks, err := server.Db.GetLeftMenuLinks(-1)
				if err != nil {
					t.Errorf("failed to retrieve menu links, error is %v", err)
				}
				received := rr.Body.String()
				data := models.Resource[[]models.LeftMenuLink]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				for _, link := range menuLinks {
					if !slices.ContainsFunc(data.Data, func(menu models.LeftMenuLink) bool {
						return menu.Name == link.Name
					}) {
						t.Error("menu links not found, out of sync")
					}
				}
			}
		})
	}
}

func getNewMenuLinksForm() map[string]any {
	form := make(map[string]any)
	menuLinks := []models.LeftMenuLink{}
	jsonStr := `[{"name":"Unlocked Labs","rank":1,"links":[{"Unlocked Labs Website":"http:\/\/www.unlockedlabs.org\/"},{"Unlocked Labs LinkedIn":"https:\/\/www.linkedin.com\/company\/labs-unlocked\/"}],"created_at":null,"updated_at":null}]`
	if err := json.Unmarshal([]byte(jsonStr), &menuLinks); err != nil {
		form["err"] = err
	}
	form["menuLinks"] = menuLinks
	return form
}
