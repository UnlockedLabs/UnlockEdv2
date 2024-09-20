package handlers

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestHandleStudentDashboard(t *testing.T) {
	httpTests := []httpTest{
		{"TestStudentDashboardAsAdmin", "admin", map[string]any{"id": "1"}, http.StatusOK, ""},
		{"TestStudentDashboardAsUser", "student", map[string]any{"id": "4"}, http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/users/{id}/student-dashboard", nil)
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleStudentDashboard, test.role)
			rr := executeRequest(t, req, handler, test)
			id, _ := strconv.Atoi(test.mapKeyValues["id"].(string))
			dashboard, err := server.Db.GetStudentDashboardInfo(id, 1)
			if err != nil {
				t.Fatal("failed to get student dashboard, error is ", err)
				return
			}
			received := rr.Body.String()
			resource := models.Resource[models.UserDashboardJoin]{}
			if err := json.Unmarshal([]byte(received), &resource); err != nil {
				t.Errorf("failed to unmarshal user dashboard")
			}
			if diff := cmp.Diff(&dashboard, &resource.Data); diff != "" {
				t.Errorf("handler returned unexpected response body: %v", diff)
			}
		})
	}
}

func TestHandleAdminDashboard(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminDashboardAsAdmin", "admin", map[string]any{"id": "1"}, http.StatusOK, ""},
		{"TestAdminDashboardAsUser", "student", map[string]any{"id": "4"}, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/users/{id}/admin-dashboard", nil)
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRoleWithMiddleware(server.handleAdminDashboard, test.role)
			rr := executeRequest(t, req, handler, test)
			id, _ := strconv.Atoi(test.mapKeyValues["id"].(string))
			if test.expectedStatusCode == http.StatusOK {
				dashboard, err := server.Db.GetAdminDashboardInfo(uint(id))
				if err != nil {
					t.Fatal("failed to get student dashboard, error is ", err)
					return
				}
				received := rr.Body.String()
				resource := models.Resource[models.AdminDashboardJoin]{}
				if err := json.Unmarshal([]byte(received), &resource); err != nil {
					t.Errorf("failed to unmarshal admin dashboard")
				}
				if diff := cmp.Diff(&dashboard, &resource.Data); diff != "" {
					t.Errorf("handler returned unexpected response body: %v", diff)
				}
			}
		})
	}
}

func TestHandleUserCatalogue(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetAllUserCatalogueAsAdmin", "admin", getUserCatalogueSearch(4, nil, "", ""), http.StatusOK, ""},
		{"TestGetAllUserCatalogueAsUser", "student", getUserCatalogueSearch(4, nil, "", ""), http.StatusOK, ""},
		{"TestGetUserCatalogueWithTagsAndOrderDescAsUser", "student", getUserCatalogueSearch(4, []string{"certificate", "grade", "progress_completion"}, "", "desc"), http.StatusOK, "?tags=certificate,grade,progress_completion&search=&order=desc"},
		{"TestGetUserCatalogueWithTagsAndOrderAscAsUser", "student", getUserCatalogueSearch(4, []string{"certificate"}, "", "asc"), http.StatusOK, "?tags=certificate&search=&order=asc"},
		{"TestUserCatalogueWithTagsAndSearchAscAsUser", "student", getUserCatalogueSearch(4, []string{"certificate", "grade", "progress_completion", "pathway_completion", "college_credit"}, "of", "asc"), http.StatusOK, "?tags=certificate,grade,progress_completion,pathway_completion,college_credit&search=of&order=asc"},
		{"TestUserCatalogueWithSearchDescAsUser", "student", getUserCatalogueSearch(4, nil, "intro", "desc"), http.StatusOK, "?search=intro&order=desc"},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/users/{id}/catalogue%s", test.queryParams), nil)
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleUserCatalogue, test.role)
			rr := executeRequest(t, req, handler, test)
			catelogueMap := test.mapKeyValues
			if catelogueMap["err"] != nil {
				t.Errorf("failed to retrieve user catelogue, error is %v", err)
			}
			data := models.Resource[[]database.UserCatalogueJoin]{}
			received := rr.Body.String()
			if err = json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("failed to unmarshal response error is %v", err)
			}
			if catelogueMap["catelogue"] != nil {
				for idx, catelogue := range catelogueMap["catelogue"].([]database.UserCatalogueJoin) {
					if catelogue.ProgramID != data.Data[idx].ProgramID {
						t.Error("user catelogues are out of sync and not ordered correctly")
					}
				}
			} else {
				t.Log("categlogue map was null")
			}
		})
	}
}

func TestHandleUserPrograms(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetAllUserProgramsAsAdmin", "admin", getUserProgramsSearch(4, "", "", "", nil), http.StatusOK, ""},
		{"TestGetAllUserProgramsAsUser", "student", getUserProgramsSearch(4, "", "", "", nil), http.StatusOK, ""},
		{"TestGetUserProgramsWithTagsAndOrderByPgNmDescAsUser", "student", getUserProgramsSearch(4, "desc", "program_name", "", []string{"certificate", "grade", "progress_completion"}), http.StatusOK, "?tags=certificate,grade,progress_completion,pathway_completion,college_credit&order=desc&order_by=program_name"},
		{"TestGetUserProgramsWithTagsAndOrderByProvNmDescAsUser", "student", getUserProgramsSearch(4, "asc", "provider_name", "", []string{"certificate", "grade", "progress_completion"}), http.StatusOK, "?tags=certificate,grade,progress_completion,pathway_completion,college_credit&order=asc&order_by=provider_name"},
		{"TestGetUserProgramsWithTagsAndOrderByCoursePgrDescAsUser", "student", getUserProgramsSearch(4, "desc", "course_progress", "", []string{"certificate", "grade", "progress_completion"}), http.StatusOK, "?tags=certificate,grade,progress_completion,pathway_completion,college_credit&order=desc&order_by=course_progress"},
		{"TestGetUserProgramsWithTagsAndOrderByProvNmDescAsUser", "student", getUserProgramsSearch(4, "asc", "provider_name", "", []string{"certificate", "grade", "progress_completion"}), http.StatusOK, "?tags=certificate,grade,progress_completion,pathway_completion,college_credit&order=asc&order_by=provider_name"},
		{"TestGetUserProgramsWithTagsAndOrderByIsFavdDescAsUser", "student", getUserProgramsSearch(4, "desc", "is_favorited", "", []string{"certificate", "grade", "progress_completion"}), http.StatusOK, "?tags=certificate,grade,progress_completion,pathway_completion,college_credit&order=desc&order_by=is_favorited"},
		{"TestGetUserProgramsWithTagsAndOrderByTotalTmDescAsUser", "student", getUserProgramsSearch(4, "desc", "total_time", "", []string{"certificate", "grade", "progress_completion"}), http.StatusOK, "?tags=certificate,grade,progress_completion,pathway_completion,college_credit&order=desc&order_by=total_time"},
		{"TestUserProgramsWithSearchAscAsUser", "student", getUserProgramsSearch(4, "asc", "", "of", []string{"certificate", "grade", "progress_completion", "pathway_completion", "college_credit"}), http.StatusOK, "?tags=certificate,grade,progress_completion,pathway_completion,college_credit&order=asc&search=of"},
		{"TestUserProgramsWithSearchDescAsUser", "student", getUserProgramsSearch(4, "desc", "", "Intro", []string{"certificate", "grade", "progress_completion", "pathway_completion", "college_credit"}), http.StatusOK, "?tags=certificate,grade,progress_completion,pathway_completion,college_credit&order=desc&search=Intro"},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/users/{id}/programs%s", test.queryParams), nil)
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleUserPrograms, test.role)
			rr := executeRequest(t, req, handler, test)
			userProgramsMap := test.mapKeyValues
			if userProgramsMap["err"] != nil {
				t.Errorf("failed to retrieve user programs, error is %v", err)
			}
			data := models.Resource[map[string]interface{}]{}
			received := rr.Body.String()
			if err = json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("failed to unmarshal response error is %v", err)
			}
			if userProgramsMap["userPrograms"] != nil {
				jsonStr, err := json.Marshal(data.Data["programs"])
				if err != nil {
					t.Error("unable to marshal response user programs, error is ", err)
				}
				responseUserPrograms := []database.UserPrograms{}
				err = json.Unmarshal(jsonStr, &responseUserPrograms)
				if err != nil {
					t.Error("unable to unmarshal response user programs, error is ", err)
				}
				for idx, userProg := range userProgramsMap["userPrograms"].([]database.UserPrograms) {
					if userProg.ID != responseUserPrograms[idx].ID {
						t.Error("user programs are out of sync and not ordered correctly")
					}
				}
			} else {
				t.Log("user program map was null, nothing to loop through")
			}
		})
	}
}

func getUserCatalogueSearch(userId int, tags []string, search, order string) map[string]any {
	catalogue, err := server.Db.GetUserCatalogue(userId, tags, search, order)
	form := make(map[string]any)
	form["catalogue"] = catalogue
	form["err"] = err
	form["id"] = strconv.Itoa(userId)
	return form
}

func getUserProgramsSearch(userId int, order, orderBy, search string, tags []string) map[string]any {
	userPrograms, numCompleted, totalTime, err := server.Db.GetUserPrograms(uint(userId), order, orderBy, search, tags)
	form := make(map[string]any)
	form["userPrograms"] = userPrograms
	form["numCompleted"] = numCompleted
	form["totalTime"] = totalTime
	form["err"] = err
	form["id"] = strconv.Itoa(userId)
	return form
}
