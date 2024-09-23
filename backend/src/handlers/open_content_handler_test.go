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
