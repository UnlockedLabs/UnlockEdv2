package handlers

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestHandleIndexMilestones(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetMilestonesAsUser", "student", nil, http.StatusOK, ""},
		{"TestGetMilestonesOrderByTypeAsAdmin", "admin", getMilestonesBySearch("assignment", "type"), http.StatusOK, "?search=assignment&order_by=type"},
		{"TestGetMilestonesOrderByUserIdAsAdmin", "admin", getMilestonesBySearch("Meagan", "user_id"), http.StatusOK, "?search=Meagan&order_by=user_id"},
		{"TestGetMilestonesOrderByUsernameAsAdmin", "admin", getMilestonesBySearch("", "username"), http.StatusOK, "?search=&order_by=username"},
		{"TestGetMilestonesOrderByProgramIdAsAdmin", "admin", getMilestonesBySearch("Introduction", "program_id"), http.StatusOK, "?search=Introduction&order_by=program_id"},
		{"TestGetMilestonesOrderByPlatformIdAsAdmin", "admin", getMilestonesBySearch("Psychology", "provider_platform_id"), http.StatusOK, "?search=Psychology&order_by=provider_platform_id"},
		{"TestGetMilestonesOrderByNameAsAdmin", "admin", getMilestonesBySearch("Claude", "name"), http.StatusOK, "?search=Claude&order_by=name"},
		{"TestGetMilestonesOrderByDescriptionAsAdmin", "admin", getMilestonesBySearch("Canvas", "description"), http.StatusOK, "?search=Canvas&order_by=description"},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/milestones%s", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRole(server.handleIndexMilestones, test.role)
			rr := executeRequest(t, req, handler, test)
			var milestones []database.MilestoneResponse
			var _ int
			var dbErr error
			if test.role == "student" {
				_, milestones, dbErr = server.Db.GetMilestonesForUser(1, 10, uint(4))
			} else {
				if test.mapKeyValues["err"] != nil {
					dbErr = test.mapKeyValues["err"].(error)
				}
				milestones = test.mapKeyValues["milestones"].([]database.MilestoneResponse)
			}
			if dbErr != nil {
				t.Fatalf("unable to get milestones from db, error is %v", dbErr)
			}
			resource := models.PaginatedResource[database.MilestoneResponse]{}
			received := rr.Body.String()
			if err = json.Unmarshal([]byte(received), &resource); err != nil {
				t.Errorf("unable to unmarshal resource, error is %v", err)
			}
			for idx, outcome := range milestones {
				if outcome.ID != resource.Data[idx].ID {
					t.Error("milestones are out of sync and not ordered correctly")
				}
			}

		})
	}
}

func TestHandleCreateMilestone(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminCanCreateMilestone", "admin", getNewMilestoneForm(), http.StatusCreated, ""},
		{"TestUserCannotCreateMilestone", "student", getNewMilestoneForm(), http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			milestoneMap := test.mapKeyValues
			if milestoneMap["err"] != nil {
				t.Fatalf("unable to create milestone form, error is %v", milestoneMap["err"])
			}
			jsonForm, err := json.Marshal(milestoneMap)
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPost, "/api/milestones", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handleCreateMilestone, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusCreated {
				received := rr.Body.String()
				data := models.Resource[models.Milestone]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				milestone, err := server.Db.GetMilestoneByID(int(data.Data.ID))
				if err != nil {
					t.Errorf("unable to get milestone from db, error is %v", err)
				}
				t.Cleanup(func() {
					err := server.Db.DeleteMilestone(int(milestone.ID))
					if err != nil {
						fmt.Println("error running clean for milestone that was created, error is ", err)
					}
				})
				if diff := cmp.Diff(milestone, &data.Data); diff != "" {
					t.Errorf("handler returned unexpected results: %v", diff)
				}
			}
		})
	}
}

func TestHandleDeleteMilestone(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotDeleteMilestone", "student", nil, http.StatusUnauthorized, ""},
		{"TestAdminCanDeleteMilestone", "admin", map[string]any{"message": "Milestone deleted successfully"}, http.StatusNoContent, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			var id uint
			if test.expectedStatusCode == http.StatusNoContent {
				milestoneModel, _, err := getNewMilestoneModelAndForm()
				if err != nil {
					t.Fatalf("unable to get a new milestone model, error is %v", err)
				}
				milestone, err := server.Db.CreateMilestone(&milestoneModel)
				if err != nil {
					t.Fatalf("unable to create milestone, error is %v", err)
				}
				id = milestone.ID
			} else {
				id = 1
			}
			req, err := http.NewRequest(http.MethodDelete, "/api/milestones", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleDeleteMilestone, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusNoContent {
				received := rr.Body.String()
				resource := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &resource); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if resource.Message != test.mapKeyValues["message"] {
					t.Errorf("handler returned wrong body: got %v want %v", resource.Message, test.mapKeyValues["message"])
				}
			}
		})
	}
}

func TestHandleUpdateMilestone(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminCanUpdateMilestone", "admin", map[string]any{"message": "Program deleted successfully"}, http.StatusOK, ""},
		{"TestUserCannotUpdateMilestone", "student", nil, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			origMilestone, milestoneForm, err := getNewMilestoneModelAndForm()
			if err != nil {
				t.Fatalf("error creating milestone model, error is %v", err)
			}
			var id uint
			if test.expectedStatusCode == http.StatusOK {
				milestone, err := server.Db.CreateMilestone(&origMilestone)
				if err != nil {
					t.Fatalf("unable to create milestone in db, error is %v", err)
				}
				id = milestone.ID
				t.Cleanup(func() {
					if err := server.Db.DeleteMilestone(int(id)); err != nil {
						fmt.Println("error running clean for milestone that was created, error is ", err)
					}
				})
			} else {
				id = 1
			}
			milestoneForm["is_completed"] = true
			jsonForm, err := json.Marshal(milestoneForm)
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPatch, "/api/milestones/", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleUpdateMilestone, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				updatedMilestone, err := server.Db.GetMilestoneByID(int(id))
				if err != nil {
					t.Fatalf("unable to get milestone from db, error is %v", err)
				}
				received := rr.Body.String()
				data := models.Resource[models.Milestone]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if diff := cmp.Diff(updatedMilestone, &data.Data); diff != "" {
					t.Errorf("handler returned unexpected results: %v", diff)
				}
			}
		})
	}
}

func getMilestonesBySearch(search, orderBy string) map[string]any {
	total, milestones, err := server.Db.GetMilestones(1, 10, search, orderBy)
	form := make(map[string]any)
	form["milestones"] = milestones
	form["total"] = total
	form["err"] = err
	return form
}

func getNewMilestoneModelAndForm() (models.Milestone, map[string]any, error) {
	milestone := models.Milestone{}
	form := getNewMilestoneForm()
	if form["err"] != nil {
		return milestone, form, form["err"].(error)
	}
	jsonString, err := json.Marshal(form)
	if err != nil {
		return milestone, form, err
	}
	err = json.Unmarshal(jsonString, &milestone)
	return milestone, form, err
}

func getNewMilestoneForm() map[string]any {
	form := make(map[string]any)
	_, courses, err := server.Db.GetProgram(1, 10, nil, "")
	if err != nil {
		form["err"] = err
	}
	_, users, err := server.Db.GetCurrentUsers(1, 10, 1, "", "", "")
	if err != nil {
		form["err"] = err
	}
	form["user_id"] = users[rand.Intn(len(users))].ID
	form["course_id"] = courses[rand.Intn(len(courses))].ID
	form["external_id"] = strconv.Itoa(rand.Intn(10000))
	form["type"] = "assignment_submission"
	form["is_completed"] = true
	return form
}
