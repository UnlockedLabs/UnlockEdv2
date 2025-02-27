package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"slices"
	"strconv"
	"testing"
)

func TestTopFacilityOpenContentHandler(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetOpenContentActivityAsUser", "student", map[string]any{"id": "1"}, http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/open-content/activity", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleGetTopFacilityOpenContent, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				id, _ := strconv.Atoi(test.mapKeyValues["id"].(string))
				expectedOpenContent, err := server.Db.GetTopFacilityOpenContent(id)
				if err != nil {
					t.Fatalf("unable to get open content, error is %v", err)
				}
				data := models.Resource[[]models.OpenContentItem]{}
				received := rr.Body.String()
				if err = json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				for _, expectedContent := range expectedOpenContent {
					if !slices.ContainsFunc(data.Data, func(opi models.OpenContentItem) bool {
						return opi.ContentId == expectedContent.ContentId && opi.OpenContentProviderId == expectedContent.OpenContentProviderId
					}) {
						t.Error("library not found, out of sync")
					}
				}
			}
		})
	}
}

func TestTopUserOpenContentHandler(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetOpenContentActivityAsUser", "student", map[string]any{"id": "4"}, http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/open-content/activity", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleGetTopUserOpenContent, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				id, _ := strconv.Atoi(test.mapKeyValues["id"].(string))
				args := models.QueryContext{FacilityID: 1}
				expectedOpenContent, err := server.Db.GetTopUserOpenContent(id, &args)
				if err != nil {
					t.Fatalf("unable to get open content, error is %v", err)
				}
				data := models.Resource[[]models.OpenContentItem]{}
				received := rr.Body.String()
				if err = json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				for _, expectedContent := range expectedOpenContent {
					if !slices.ContainsFunc(data.Data, func(opi models.OpenContentItem) bool {
						return opi.ContentId == expectedContent.ContentId && opi.OpenContentProviderId == expectedContent.OpenContentProviderId
					}) {
						t.Error("library not found, out of sync")
					}
				}
			}
		})
	}
}
