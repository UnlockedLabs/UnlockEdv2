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
		{"TestGetFacilitiesAsAdmin", "admin", nil, http.StatusOK, ""},
		{"TestGetFacilitiesAsUser", "student", nil, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/facilities", nil)
			if err != nil {
				t.Fatal(err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handleIndexFacilities, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				facilities, err := server.Db.GetAllFacilities()
				if err != nil {
					t.Errorf("failed to retrieve facilities, error is %v", err)
				}
				data := models.Resource[[]models.Facility]{}
				received := rr.Body.String()
				if err = json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal response error is %v", err)
				}
				//loop through entire...list of facilities
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
				t.Fatal(err)
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
					t.Fatal(err)
					return
				}
				received := rr.Body.String()
				unmarshaled := models.Resource[models.Facility]{}
				if err := json.Unmarshal([]byte(received), &unmarshaled); err != nil {
					t.Errorf("failed to unmarshal user")
				}
				if diff := cmp.Diff(facility, &unmarshaled.Data); diff != "" {
					t.Errorf("handler returned unexpected response body: %v", diff)
				}
			}
		})
	}
}

// // NOTE: found possible bug with the database maybe??? need to make sure that users are being inserted with tolowercase
func TestHandleCreateFacility(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminCanCreateFacility", "admin", map[string]any{"name": "Ozark Correctional Center"}, http.StatusOK, ""},
		{"TestUserCannotCreateFacility", "student", nil, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			jsonForm, err := json.Marshal(test.mapKeyValues)
			if err != nil {
				t.Errorf("failed to marshal form")
			}
			req, err := http.NewRequest(http.MethodPost, "/api/facilities", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatal(err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handleCreateFacility, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				received := rr.Body.String()
				data := models.Resource[models.Facility]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal user")
				}
				facility, err := server.Db.GetFacilityByID(int(data.Data.ID))
				if err != nil {
					t.Fatal(err)
				}
				t.Cleanup(func() {
					err := server.Db.DeleteFacility(int(facility.ID))
					if err != nil {
						fmt.Println(err)
					}
				})
				if diff := cmp.Diff(facility, &data.Data); diff != "" {
					t.Errorf("handler returned unexpected results: %v", diff)
				}
			}
		})
	}
}

func TestHandleUpdateFacility(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminCanUpdateFacility", "admin", map[string]any{"name": "Ozark Correctional Center"}, http.StatusOK, ""},
		{"TestUserCannotUpdateFacility", "student", nil, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			var id uint
			if test.expectedStatusCode == http.StatusOK {
				facility, err := server.Db.CreateFacility("Ozark Correct. Cent.")
				if err != nil {
					t.Errorf("failed to create user")
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
				t.Errorf("failed to marshal form")
			}
			req, err := http.NewRequest(http.MethodPatch, "/api/facilities/", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleUpdateFacility, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				facility, err := server.Db.GetFacilityByID(int(id))
				if err != nil {
					t.Fatal(err)
				}
				received := rr.Body.String()
				data := models.Resource[models.Facility]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal user")
				}
				if diff := cmp.Diff(facility, &data.Data); diff != "" {
					t.Errorf("handler returned unexpected results: %v", diff)
				}
			}
		})
	}
}

// // // added if !srv.isTesting(r) {} around kratos calls
func TestHandleDeleteFacility(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotDeleteFacility", "student", nil, http.StatusUnauthorized, ""},
		{"TestAdminCanDeleteFacility", "admin", map[string]any{"message": "facility deleted successfully"}, http.StatusNoContent, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			var id uint
			if test.expectedStatusCode == http.StatusNoContent {
				facility, err := server.Db.CreateFacility("Ozark Correctional Center")
				if err != nil {
					t.Errorf("failed to create facility")
				}
				id = facility.ID
			} else {
				id = 1
			}
			req, err := http.NewRequest(http.MethodDelete, "/api/facilities/", nil)
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleDeleteFacility, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusNoContent {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal user")
				}
				if data.Message != test.mapKeyValues["message"] {
					t.Errorf("handler returned wrong body: got %v want %v", data.Message, test.mapKeyValues["message"])
				}
			}
		})
	}
}
