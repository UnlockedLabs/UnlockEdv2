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

func TestHandleIndexFacilities(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetFacilitiesAsAdmin", "admin", map[string]any{"page": 1, "per_page": 10}, http.StatusOK, "?page=1&per_page=10"},
		{"TestGetFacilitiesAsUser", "student", map[string]any{"page": 1, "per_page": 10}, http.StatusUnauthorized, "?page=1&per_page=10"},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/facilities%v", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handleIndexFacilities, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				_, facilities, err := server.Db.GetAllFacilities(test.mapKeyValues["page"].(int), test.mapKeyValues["per_page"].(int))
				if err != nil {
					t.Fatalf("unable to retrieve facilities, error is %v", err)
				}
				data := models.Resource[[]models.Facility]{}
				received := rr.Body.String()
				if err = json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				for _, facility := range facilities {
					if !slices.ContainsFunc(data.Data, func(fac models.Facility) bool {
						return fac.ID == facility.ID
					}) {
						t.Error("facilities not found, out of sync")
					}
				}
			}
		})
	}
}

func TestHandleShowFacility(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetFacilityAsAdmin", "admin", map[string]any{"id": "1"}, http.StatusOK, ""},
		{"TestGetFacilityAsUser", "student", map[string]any{"id": "1"}, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/facilities/", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			//can remove this out
			handler := getHandlerByRoleWithMiddleware(server.handleShowFacility, test.role)
			rr := executeRequest(t, req, handler, test)
			//can remove this out all these are the same
			if test.expectedStatusCode == http.StatusOK {
				id, _ := strconv.Atoi(test.mapKeyValues["id"].(string))
				facility, err := server.Db.GetFacilityByID(id)
				if err != nil {
					t.Fatalf("unable to get facility from db, error is %v", err)
				}
				received := rr.Body.String()
				resource := models.Resource[models.Facility]{}
				if err := json.Unmarshal([]byte(received), &resource); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if diff := cmp.Diff(facility, &resource.Data); diff != "" {
					t.Errorf("handler returned unexpected response body: %v", diff)
				}
			}
		})
	}
}

func TestHandleCreateFacility(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminCanCreateFacility", "admin", map[string]any{"name": "Ozark Correctional Center", "timezone": "America/Chicago"}, http.StatusCreated, ""},
		{"TestAdminCannotCreateInvalidTimezone", "admin", map[string]any{"name": "Ozark Correctional Center", "timezone": "Canada/Chicago"}, http.StatusBadRequest, ""},
		{"TestUserCannotCreateFacility", "student", nil, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			jsonForm, err := json.Marshal(test.mapKeyValues)
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPost, "/api/facilities", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handleCreateFacility, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusCreated {
				received := rr.Body.String()
				data := models.Resource[models.Facility]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				facility, err := server.Db.GetFacilityByID(int(data.Data.ID))
				if err != nil {
					t.Fatalf("unable to get facility from db, error is %v", err)
				}
				t.Cleanup(func() {
					err := server.Db.DeleteFacility(int(facility.ID))
					if err != nil {
						fmt.Printf("unable to cleanup/delete facility from db, error is %v", err)
					}
				})
				if diff := cmp.Diff(facility, &data.Data); diff != "" {
					t.Errorf("handler returned unexpected results: %v", diff)
				}
			}
		})
	}
}

const ozark string = "Ozark Correctional Center"

func TestHandleUpdateFacility(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminCanUpdateFacility", "admin", map[string]any{"name": ozark}, http.StatusOK, ""},
		{"TestUserCannotUpdateFacility", "student", nil, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			var id uint
			if test.expectedStatusCode == http.StatusOK {

				facility := models.Facility{Name: "Test Correctional Center", Timezone: "America/Chicago"}
				err := server.Db.CreateFacility(&facility)
				if err != nil {
					t.Fatalf("unable to create facility, error is %v", err)
				}
				id = facility.ID
				t.Cleanup(func() {
					if err := server.Db.DeleteFacility(int(id)); err != nil {
						fmt.Println("Unable to delete facility. Error is: ", err)
					}
				})
			} else {
				id = 1
			}
			jsonForm, err := json.Marshal(test.mapKeyValues)
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPatch, "/api/facilities/", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleUpdateFacility, test.role)
			_ = executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				facility, err := server.Db.GetFacilityByID(int(id))

				if err != nil {
					t.Fatalf("unable to get facility from db, error is %v", err)
				}
				if facility.Name != ozark {
					t.Error("facility did not update properly")
				}
			}
		})
	}
}

func TestHandleDeleteFacility(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotDeleteFacility", "student", nil, http.StatusUnauthorized, ""},
		{"TestAdminCanDeleteFacility", "admin", map[string]any{"message": "facility deleted successfully"}, http.StatusNoContent, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			var id uint
			if test.expectedStatusCode == http.StatusNoContent {
				facility := models.Facility{Name: "Ozark Correctional Center", Timezone: "America/Chicago"}
				err := server.Db.CreateFacility(&facility)
				if err != nil {
					t.Errorf("failed to create facility")
				}
				id = facility.ID
			} else {
				id = 1
			}
			req, err := http.NewRequest(http.MethodDelete, "/api/facilities/", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleDeleteFacility, test.role)
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