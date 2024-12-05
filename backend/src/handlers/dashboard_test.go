package handlers

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
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
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleStudentDashboard, test.role)
			rr := executeRequest(t, req, handler, test)
			id, _ := strconv.Atoi(test.mapKeyValues["id"].(string))
			dashboard, err := server.Db.GetStudentDashboardInfo(id, 1)
			if err != nil {
				t.Fatalf("unable to get student dashboard, error is %v", err)
			}
			received := rr.Body.String()
			resource := models.Resource[models.UserDashboardJoin]{}
			if err := json.Unmarshal([]byte(received), &resource); err != nil {
				t.Errorf("failed to unmarshal resource, error is %v", err)
			}
			for _, enrollment := range dashboard.Enrollments {
				if !slices.ContainsFunc(resource.Data.Enrollments, func(enro models.CurrentEnrollment) bool {
					return enro.Name == enrollment.Name
				}) {
					t.Error("enrollment not found, out of sync")
				}
			}
			for _, recentCourse := range dashboard.RecentCourses {
				if !slices.ContainsFunc(resource.Data.RecentCourses, func(course models.RecentCourse) bool {
					return course.CourseName == recentCourse.CourseName
				}) {
					t.Error("recent course not found, out of sync")
				}
			}
			for _, topCourse := range dashboard.TopCourses {
				if !slices.ContainsFunc(resource.Data.TopCourses, func(course string) bool {
					return topCourse == course
				}) {
					t.Error("top course not found, out of sync")
				}
			}
			for _, weekAct := range dashboard.WeekActivity {
				if !slices.ContainsFunc(resource.Data.WeekActivity, func(recentAct models.RecentActivity) bool {
					return recentAct.Date == weekAct.Date
				}) {
					t.Error("week activity not found, out of sync")
				}
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
			catelogueMap := test.mapKeyValues
			if catelogueMap["err"] != nil {
				t.Fatalf("unable to retrieve user catelogue, error is %v", catelogueMap["err"])
			}
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/users/{id}/catalogue%s", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleUserCatalogue, test.role)
			rr := executeRequest(t, req, handler, test)
			data := models.Resource[[]database.UserCatalogueJoin]{}
			received := rr.Body.String()
			if err = json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("unable to unmarshal resource, error is %v", err)
			}
			if catelogueMap["catelogue"] != nil {
				for idx, catelogue := range catelogueMap["catelogue"].([]database.UserCatalogueJoin) {
					if catelogue.CourseID != data.Data[idx].CourseID {
						t.Error("user catelogues are out of sync and not ordered correctly")
					}
				}
			}
		})
	}
}

func TestHandleUserCourses(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetAllUserCoursesAsAdmin", "admin", getUserCoursesSearch(4, "", "", "", nil), http.StatusOK, ""},
		{"TestGetAllUserCoursesAsUser", "student", getUserCoursesSearch(4, "", "", "", nil), http.StatusOK, ""},
		{"TestGetAllUserCoursesOrderByStartDtDescAsUser", "student", getUserCoursesSearch(4, "desc", "start_dt", "", nil), http.StatusOK, "?order=desc&order_by=start_dt"},
		{"TestGetAllUserCoursesOrderByStopDtDescAsUser", "student", getUserCoursesSearch(4, "desc", "stop_dt", "", nil), http.StatusOK, "?order=desc&order_by=stop_dt"},
		{"TestGetUserCoursesWithTagsAndOrderByPgNmDescAsUser", "student", getUserCoursesSearch(4, "desc", "program_name", "", []string{"certificate", "grade", "progress_completion"}), http.StatusOK, "?tags=certificate,grade,progress_completion,pathway_completion,college_credit&order=desc&order_by=program_name"},
		{"TestGetUserCoursesWithTagsAndOrderByProvNmDescAsUser", "student", getUserCoursesSearch(4, "asc", "provider_name", "", []string{"certificate", "grade", "progress_completion"}), http.StatusOK, "?tags=certificate,grade,progress_completion,pathway_completion,college_credit&order=asc&order_by=provider_name"},
		{"TestGetUserCoursesWithTagsAndOrderByCoursePgrDescAsUser", "student", getUserCoursesSearch(4, "desc", "course_progress", "", []string{"certificate", "grade", "progress_completion"}), http.StatusOK, "?tags=certificate,grade,progress_completion,pathway_completion,college_credit&order=desc&order_by=course_progress"},
		{"TestGetUserCoursesWithTagsAndOrderByProvNmDescAsUser", "student", getUserCoursesSearch(4, "asc", "provider_name", "", []string{"certificate", "grade", "progress_completion"}), http.StatusOK, "?tags=certificate,grade,progress_completion,pathway_completion,college_credit&order=asc&order_by=provider_name"},
		{"TestGetUserCoursesWithTagsAndOrderByTotalTmDescAsUser", "student", getUserCoursesSearch(4, "desc", "total_time", "", []string{"certificate", "grade", "progress_completion"}), http.StatusOK, "?tags=certificate,grade,progress_completion,pathway_completion,college_credit&order=desc&order_by=total_time"},
		{"TestUserCoursesWithSearchAscAsUser", "student", getUserCoursesSearch(4, "asc", "", "of", []string{"certificate", "grade", "progress_completion", "pathway_completion", "college_credit"}), http.StatusOK, "?tags=certificate,grade,progress_completion,pathway_completion,college_credit&order=asc&search=of"},
		{"TestUserCoursesWithSearchDescAsUser", "student", getUserCoursesSearch(4, "desc", "", "Intro", []string{"certificate", "grade", "progress_completion", "pathway_completion", "college_credit"}), http.StatusOK, "?tags=certificate,grade,progress_completion,pathway_completion,college_credit&order=desc&search=Intro"},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			userCoursesMap := test.mapKeyValues
			if userCoursesMap["err"] != nil {
				t.Fatalf("unable to get user courses, error is %v", userCoursesMap["err"])
			}
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/users/{id}/courses%s", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleUserCourses, test.role)
			rr := executeRequest(t, req, handler, test)
			data := models.Resource[map[string]interface{}]{}
			received := rr.Body.String()
			if err = json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("failed to unmarshal resource, error is %v", err)
			}
			if userCoursesMap["userCourses"] != nil {
				jsonStr, err := json.Marshal(data.Data["courses"])
				if err != nil {
					t.Error("unable to marshal response user courses, error is ", err)
				}
				responseUserCourses := []database.UserCourses{}
				err = json.Unmarshal(jsonStr, &responseUserCourses)
				if err != nil {
					t.Error("unable to unmarshal response user courses, error is ", err)
				}
				for idx, userProg := range userCoursesMap["userCourses"].([]database.UserCourses) {
					if userProg.ID != responseUserCourses[idx].ID {
						t.Error("user courses are out of sync and not ordered correctly")
					}
				}
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

func getUserCoursesSearch(userId int, order, orderBy, search string, tags []string) map[string]any {
	userCourses, numCompleted, totalTime, err := server.Db.GetUserCourses(uint(userId), order, orderBy, search, tags)
	form := make(map[string]any)
	form["userCourses"] = userCourses
	form["numCompleted"] = numCompleted
	form["totalTime"] = totalTime
	form["err"] = err
	form["id"] = strconv.Itoa(userId)
	return form
}
