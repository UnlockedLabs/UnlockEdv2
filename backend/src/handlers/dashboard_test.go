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

func TestHandleAdminDashboard(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminDashboardAsAdmin", "admin", map[string]any{"id": "1"}, http.StatusOK, ""},
		{"TestAdminDashboardAsUser", "student", map[string]any{"id": "4"}, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/users/{id}/admin-dashboard", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRoleWithMiddleware(server.handleAdminDashboard, test.role)
			rr := executeRequest(t, req, handler, test)
			id, _ := strconv.Atoi(test.mapKeyValues["id"].(string))
			if test.expectedStatusCode == http.StatusOK {
				dashboard, err := server.Db.GetAdminDashboardInfo(uint(id))
				if err != nil {
					t.Fatalf("unable to get student dashboard, error is %v", err)
				}
				received := rr.Body.String()
				resource := models.Resource[models.AdminDashboardJoin]{}
				if err := json.Unmarshal([]byte(received), &resource); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if diff := cmp.Diff(&dashboard, &resource.Data); diff != "" {
					t.Errorf("handler returned unexpected response body: %v", diff)
				}
			}
		})
	}
}

func TestHandleAdminLayer2(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminDashboardAsAdmin", "admin", map[string]any{"id": "1"}, http.StatusOK, ""},
		{"TestAdminDashboardAsUser", "student", map[string]any{"id": "4"}, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/users/{id}/admin-layer2", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRoleWithMiddleware(server.handleAdminLayer2, test.role)
			rr := executeRequest(t, req, handler, test)
			id, _ := strconv.Atoi(test.mapKeyValues["id"].(string))
			if test.expectedStatusCode == http.StatusOK {

				id := uint(id)
				totalCourses, err := server.Db.GetTotalCoursesOffered(&id)
				if err != nil {
					t.Fatalf("unable to get total courses offered, error is %v", err)
				}
				totalStudents, err := server.Db.GetTotalStudentsEnrolled(&id)
				if err != nil {
					t.Fatalf("unable to get total students enrolled, error is %v", err)
				}
				totalActivity, err := server.Db.GetTotalHourlyActivity(&id)
				if err != nil {
					t.Fatalf("unable to get total hourly activity, error is %v", err)
				}
				learningInsights, err := server.Db.GetLearningInsights(&id)
				if err != nil {
					t.Fatalf("unable to get learning insights, error is %v", err)
				}
				adminDashboard := models.AdminLayer2Join{
					TotalCoursesOffered:   int64(totalCourses),
					TotalStudentsEnrolled: int64(totalStudents),
					TotalHourlyActivity:   int64(totalActivity),
					LearningInsights:      learningInsights,
				}

				received := rr.Body.String()
				resource := models.Resource[models.AdminLayer2Join]{}
				if err := json.Unmarshal([]byte(received), &resource); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if diff := cmp.Diff(&adminDashboard, &resource.Data); diff != "" {
					t.Errorf("handler returned unexpected response body: %v", diff)
				}
			}
		})
	}
}

func TestHandleUserCatalog(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetAllUserCatalogAsAdmin", "admin", getUserCatalogSearch(4, nil, "", ""), http.StatusOK, ""},
		{"TestGetAllUserCatalogAsUser", "student", getUserCatalogSearch(4, nil, "", ""), http.StatusOK, ""},
		{"TestGetUserCatalogWithTagsAndOrderDescAsUser", "student", getUserCatalogSearch(4, []string{"certificate", "grade", "progress_completion"}, "", "desc"), http.StatusOK, "?tags=certificate,grade,progress_completion&search=&order=desc"},
		{"TestGetUserCatalogWithTagsAndOrderAscAsUser", "student", getUserCatalogSearch(4, []string{"certificate"}, "", "asc"), http.StatusOK, "?tags=certificate&search=&order=asc"},
		{"TestUserCatalogWithTagsAndSearchAscAsUser", "student", getUserCatalogSearch(4, []string{"certificate", "grade", "progress_completion", "pathway_completion", "college_credit"}, "of", "asc"), http.StatusOK, "?tags=certificate,grade,progress_completion,pathway_completion,college_credit&search=of&order=asc"},
		{"TestUserCatalogWithSearchDescAsUser", "student", getUserCatalogSearch(4, nil, "intro", "desc"), http.StatusOK, "?search=intro&order=desc"},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			catelogueMap := test.mapKeyValues
			if catelogueMap["err"] != nil {
				t.Fatalf("unable to retrieve user catelogue, error is %v", catelogueMap["err"])
			}
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/users/{id}/catalog%s", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleUserCatalog, test.role)
			rr := executeRequest(t, req, handler, test)
			data := models.Resource[[]database.UserCatalogJoin]{}
			received := rr.Body.String()
			if err = json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("unable to unmarshal resource, error is %v", err)
			}
			if catelogueMap["catelogue"] != nil {
				for idx, catelogue := range catelogueMap["catelogue"].([]database.UserCatalogJoin) {
					if catelogue.CourseID != data.Data[idx].CourseID {
						t.Error("user catelogues are out of sync and not ordered correctly")
					}
				}
			}
		})
	}
}

func getUserCatalogSearch(userId int, tags []string, search, order string) map[string]any {
	catalog, err := server.Db.GetUserCatalog(userId, tags, search, order)
	form := make(map[string]any)
	form["catalog"] = catalog
	form["err"] = err
	form["id"] = strconv.Itoa(userId)
	return form
}
