package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
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
			outcomeMap := test.mapKeyValues
			if outcomeMap["err"] != nil {
				t.Fatalf("unable to get outcomes from db, error is %v", outcomeMap["err"])
			}
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/users/{id}/outcomes%s", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleGetOutcomes, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				data := models.PaginatedResource[models.Outcome]{}
				received := rr.Body.String()
				if err = json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
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
