package handlers

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
)

func TestHandleGetOutcomes(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetAllOutcomesAsAdmin", "admin", getOutcomesByTypeAndOrdered("", "", ""), http.StatusOK, ""},
		{"TestGetAllOutcomesAsUser", "student", getOutcomesByTypeAndOrdered("", "", ""), http.StatusOK, ""},
		{"TestGetCertOutcomesAsUser", "student", getOutcomesByTypeAndOrdered("certificate", "type", "desc"), http.StatusOK, "?order=desc&type=certificate&order_by=type"},
		{"TestGetGradeOutcomesAsUser", "student", getOutcomesByTypeAndOrdered("grade", "type", "asc"), http.StatusOK, "?order=asc&type=grade&order_by=type"},
		{"TestGetProgCmpOutcomesAsUser", "student", getOutcomesByTypeAndOrdered("progress_completion", "created_at", "desc"), http.StatusOK, "?order=desc&type=progress_completion&order_by=created_at"},
		{"TestGetPtCmpOutcomesAsUser", "student", getOutcomesByTypeAndOrdered("pathway_completion", "created_at", "asc"), http.StatusOK, "?order=asc&type=pathway_completion&order_by=created_at"},
		{"TestGetColCredOutcomesAsUser", "student", getOutcomesByTypeAndOrdered("college_credit", "type", "desc"), http.StatusOK, "?order=desc&type=college_credit&order_by=type"},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/users/{id}/outcomes%s", test.queryParams), nil)
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleGetOutcomes, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				outcomeMap := test.mapKeyValues
				if outcomeMap["err"] != nil {
					t.Errorf("failed to retrieve outcomes, error is %v", err)
				}
				data := models.PaginatedResource[models.Outcome]{}
				received := rr.Body.String()
				if err = json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal response error is %v", err)
				}
				for idx, outcome := range outcomeMap["outcomes"].([]models.Outcome) {
					if outcome.ID != data.Data[idx].ID {
						t.Error("outcomes are out of sync and not ordered correctly")
					}
				}
			}
		})
	}
}

func TestHandleCreateOutcome(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminCanCreateOutcome", "admin", getNewOutcome(), http.StatusCreated, ""},
		{"TestUserCanCreateOutcome", "student", getNewOutcome(), http.StatusCreated, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			outcomeMap := test.mapKeyValues
			if outcomeMap["err"] != nil {
				t.Fatal("unable to create new outcome, error is ", outcomeMap["err"])
			}
			jsonForm, err := json.Marshal(outcomeMap)
			if err != nil {
				t.Errorf("failed to marshal form")
			}
			req, err := http.NewRequest(http.MethodPost, "/api/users/{id}/outcomes", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", strconv.Itoa(int(test.mapKeyValues["user_id"].(uint))))
			handler := getHandlerByRole(server.handleCreateOutcome, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusCreated {
				received := rr.Body.String()
				data := models.Resource[models.Outcome]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Error("failed to unmarshal response")
				}
				outcome := &models.Outcome{}
				if err := server.Db.Where("id = ?", fmt.Sprintf("%d", data.Data.ID)).First(&outcome).Error; err != nil {
					t.Error("error getting outcome from db, error is ", err)
				}
				t.Cleanup(func() {
					err := server.Db.DeleteOutcome(data.Data.ID)
					if err != nil {
						fmt.Println("error running clean for program that was created, error is ", err)
					}
				})
				if diff := cmp.Diff(outcome, &data.Data); diff != "" {
					t.Errorf("handler returned unexpected response body: %v", diff)
				}
			}
		})
	}
}

func TestHandleUpdateOutcome(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminCanUpdateProgram", "admin", nil, http.StatusOK, ""},
		{"TestUserCannotUpdateProgram", "student", nil, http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			newOutcome, form, err := getNewOutcomeModel()
			if err != nil {
				t.Fatal("failed to create new outcome model, error is ", err)
			}
			origOutcome, err := server.Db.CreateOutcome(&newOutcome)
			if err != nil {
				t.Errorf("failed to create outcome to update")
			}
			t.Cleanup(func() {
				if err := server.Db.DeleteOutcome(origOutcome.ID); err != nil {
					fmt.Println("error running clean for outcome that was created, error is ", err)
				}
			})
			//make some updates
			form["value"] = "just an update"
			jsonForm, err := json.Marshal(form)
			if err != nil {
				t.Errorf("failed to marshal form")
			}
			req, err := http.NewRequest(http.MethodPatch, "/api/users/{id}/outcomes/{oid}", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", origOutcome.UserID))
			req.SetPathValue("oid", fmt.Sprintf("%d", origOutcome.ID))
			handler := getHandlerByRole(server.handleUpdateOutcome, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				received := rr.Body.String()
				data := models.Resource[models.Outcome]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal program")
				}
				outcome := &models.Outcome{}
				if err := server.Db.Where("id = ?", fmt.Sprintf("%d", origOutcome.ID)).First(&outcome).Error; err != nil {
					t.Error("error getting outcome from db, error is ", err)
				}
				if diff := cmp.Diff(outcome, &data.Data, cmpopts.IgnoreFields(models.Outcome{}, "UpdatedAt")); diff != "" {
					t.Errorf("handler returned unexpected results: %v", diff)
				}
			}
		})
	}
}

func TestHandleDeleteOutcome(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCanDeleteOutcome", "student", map[string]any{"message": "Outcome deleted successfully"}, http.StatusNoContent, ""},
		{"TestAdminCanDeleteOutcome", "admin", map[string]any{"message": "Outcome deleted successfully"}, http.StatusNoContent, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			newOutcome, _, err := getNewOutcomeModel()
			if err != nil {
				t.Fatal("failed to create new outcome model, error is ", err)
			}
			origOutcome, err := server.Db.CreateOutcome(&newOutcome)
			if err != nil {
				t.Errorf("failed to create outcome to delete")
			}
			req, err := http.NewRequest(http.MethodDelete, "/api/users/{id}/outcomes/{oid}", nil)
			if err != nil {
				t.Fatal(err)
			}
			//req.SetPathValue("id", fmt.Sprintf("%d", origOutcome.UserID))
			req.SetPathValue("oid", fmt.Sprintf("%d", origOutcome.ID))
			handler := getHandlerByRole(server.handleDeleteOutcome, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusNoContent {
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

func getOutcomesByTypeAndOrdered(outcomeType, orderBy, order string) map[string]any {
	var outType models.OutcomeType
	if outcomeType != "" {
		outType = models.OutcomeType(outcomeType)
	}
	total, outcomes, err := server.Db.GetOutcomesForUser(4, 1, 10, order, orderBy, outType)
	form := make(map[string]any)
	form["outcomes"] = outcomes
	form["err"] = err
	form["total"] = total
	form["id"] = "4"
	return form
}

func getNewOutcome() map[string]any {
	form := make(map[string]any)
	_, programs, err := server.Db.GetProgram(1, 10, "")
	if err != nil {
		form["err"] = err
	}
	_, users, err := server.Db.GetCurrentUsers(1, 10, 1, "", "")
	if err != nil {
		form["err"] = err
	}
	outcomes := []string{"completion", "grade", "certificate", "pathway_completion"}
	if form["err"] == nil {
		form["type"] = models.OutcomeType(outcomes[rand.Intn(len(outcomes))])
		form["program_id"] = programs[rand.Intn(len(programs))].ID
		form["user_id"] = users[rand.Intn(len(users))].ID
	}
	return form
}

func getNewOutcomeModel() (models.Outcome, map[string]any, error) {
	outcome := models.Outcome{}
	form := getNewOutcome()
	if form["err"] != nil {
		return outcome, form, form["err"].(error)
	}
	jsonString, err := json.Marshal(form)
	if err != nil {
		return outcome, form, err
	}
	err = json.Unmarshal(jsonString, &outcome)
	return outcome, form, err
}
