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
		{"TestGetMilestonesOrderByTypeAsAdmin", "admin", getMilestonesBySearch("assignment", "type"), http.StatusOK, "?search=assignment&orderBy=type"},
		{"TestGetMilestonesOrderByUserIdAsAdmin", "admin", getMilestonesBySearch("Meagan", "user_id"), http.StatusOK, "?search=Meagan&orderBy=user_id"},
		{"TestGetMilestonesOrderByUsernameAsAdmin", "admin", getMilestonesBySearch("", "username"), http.StatusOK, "?search=&orderBy=username"},
		{"TestGetMilestonesOrderByProgramIdAsAdmin", "admin", getMilestonesBySearch("Introduction", "program_id"), http.StatusOK, "?search=Introduction&orderBy=program_id"},
		{"TestGetMilestonesOrderByPlatformIdAsAdmin", "admin", getMilestonesBySearch("Psychology", "provider_platform_id"), http.StatusOK, "?searchPsychology=&orderBy=provider_platform_id"},
		{"TestGetMilestonesOrderByNameAsAdmin", "admin", getMilestonesBySearch("Claude", "name"), http.StatusOK, "?search=Claude&orderBy=name"},
		{"TestGetMilestonesOrderByDescriptionAsAdmin", "admin", getMilestonesBySearch("Canvas", "description"), http.StatusOK, "?search=Canvas&orderBy=description"},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/milestones%s", test.queryParams), nil)
			if err != nil {
				t.Fatal(err)
			}
			handler := getHandlerByRole(server.handleIndexMilestones, test.role)
			rr := executeRequest(t, req, handler, test)
			var milestones []database.MilestoneResponse
			var _ int
			var dbErr error
			if test.role == "student" {
				_, milestones, dbErr = server.Db.GetMilestonesForUser(1, 10, uint(4)) //TODO CREATE CONSTANT for this user
			} else {
				if test.mapKeyValues["err"] != nil {
					dbErr = test.mapKeyValues["err"].(error)
				}
				milestones = test.mapKeyValues["milestones"].([]database.MilestoneResponse)
			}
			if dbErr != nil {
				t.Errorf("failed to get milestones from db, error is %v", dbErr)
			}
			data := models.PaginatedResource[database.MilestoneResponse]{}
			received := rr.Body.String()
			if err = json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("failed to unmarshal response error is %v", err)
			}
			for idx, outcome := range milestones {
				if outcome.ID != data.Data[idx].ID {
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
				t.Fatal("unable to create milestone form, error is ", milestoneMap["err"])
			}
			jsonForm, err := json.Marshal(milestoneMap)
			if err != nil {
				t.Errorf("failed to marshal form")
			}
			req, err := http.NewRequest(http.MethodPost, "/api/milestones", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatal(err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handleCreateMilestone, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusCreated {
				received := rr.Body.String()
				data := models.Resource[models.Milestone]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal response error is %v", err)
				}
				milestone, err := server.Db.GetMilestoneByID(int(data.Data.ID))
				if err != nil {
					t.Error("unable to get milestone from db, error is ", err)
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
		{"TestAdminCanDeleteMilestone", "admin", map[string]any{"message": "Milestone deleted successfully"}, http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			var id uint
			if test.expectedStatusCode == http.StatusOK {
				milestoneModel, _, err := getNewMilestoneModelAndForm()
				if err != nil {
					t.Fatal("failed to get a new milestone model, error is ", err)
				}
				milestone, err := server.Db.CreateMilestone(&milestoneModel)
				if err != nil {
					t.Errorf("failed to create milestone")
				}
				id = milestone.ID
			} else {
				id = 1
			}
			req, err := http.NewRequest(http.MethodDelete, "/api/milestones", nil)
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleDeleteMilestone, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal response error is %v", err)
				}
				if data.Message != test.mapKeyValues["message"] {
					t.Errorf("handler returned wrong body: got %v want %v", data.Message, test.mapKeyValues["message"])
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
				t.Fatal("error creating milestone model, error is ", err)
			}
			var id uint
			if test.expectedStatusCode == http.StatusOK {
				milestone, err := server.Db.CreateMilestone(&origMilestone)
				if err != nil {
					t.Errorf("failed to create milestone to update")
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
				t.Errorf("failed to marshal form")
			}
			req, err := http.NewRequest(http.MethodPatch, "/api/milestones/", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleUpdateMilestone, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				updatedMilestone, err := server.Db.GetMilestoneByID(int(id))
				if err != nil {
					t.Fatal(err)
				}
				received := rr.Body.String()
				data := models.Resource[models.Milestone]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal milestone")
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
	_, programs, err := server.Db.GetProgram(1, 10, "")
	if err != nil {
		form["err"] = err
	}
	_, users, err := server.Db.GetCurrentUsers(1, 10, 1, "", "")
	if err != nil {
		form["err"] = err
	}
	form["user_id"] = users[rand.Intn(len(users))].ID
	form["program_id"] = programs[rand.Intn(len(programs))].ID
	form["external_id"] = strconv.Itoa(rand.Intn(10000))
	form["type"] = "assignment_submission"
	form["is_completed"] = true
	return form
}
