package handlers

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"slices"
	"strconv"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestHandleIndexCourses(t *testing.T) {
	httpTests := []httpTest{
		{"TestIndexCoursesAsAdmin", "admin", getCourseSearch("Botany"), http.StatusOK, "?search=Botany"},
		{"TestIndexCoursesAsUser", "student", getCourseSearch(""), http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			courseMap := test.mapKeyValues
			if courseMap["err"] != nil {
				t.Fatalf("unable to get courses from db, error is %v", courseMap["err"])
			}
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/courses%s", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handleIndexCourses, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				data := models.PaginatedResource[models.Course]{}
				received := rr.Body.String()
				if err = json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal response, error is %v", err)
				}
				for _, course := range courseMap["courses"].([]models.Course) {
					if !slices.ContainsFunc(data.Data, func(sec models.Course) bool {
						return sec.ID == course.ID
					}) {
						t.Error("courses not found, out of sync")
					}
				}
			}
		})
	}
}

func TestHandleShowCourse(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminShowCourse", "admin", getCourseSearch(""), http.StatusOK, ""},
		{"TestUserCanShowCourse", "student", getCourseSearch(""), http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			courseMap := test.mapKeyValues
			if courseMap["err"] != nil {
				t.Fatalf("unable to get courses, error is %v", courseMap["err"])
			}
			req, err := http.NewRequest(http.MethodGet, "/api/courses/{id}", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			courses := courseMap["courses"].([]models.Course)
			course := courses[rand.Intn(len(courses))]
			req.SetPathValue("id", strconv.Itoa(int(course.ID)))
			handler := getHandlerByRole(server.handleShowCourse, test.role)
			rr := executeRequest(t, req, handler, test)
			received := rr.Body.String()
			data := models.Resource[models.Course]{}
			if err := json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("failed to unmarshal resource, error is %v", err)
			}
			if diff := cmp.Diff(&course, &data.Data); diff != "" {
				t.Errorf("handler returned unexpected response body: %v", diff)
			}
		})
	}
}

func TestHandleCreateCourse(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotCreateCourse", "student", getNewCourseForm(), http.StatusUnauthorized, ""},
		{"TestAdminCanCreateCourse", "admin", getNewCourseForm(), http.StatusCreated, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			courseMap := test.mapKeyValues
			jsonForm, err := json.Marshal(courseMap["course"])
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPost, "/api/courses", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handleCreateCourse, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusCreated {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if data.Message != "Course created successfully" {
					t.Errorf("handler returned wrong body: got %v want %v", data.Message, "Course created successfully")
				}
			}
		})
	}
}

func TestHandleDeleteCourse(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotDeleteCourse", "student", getNewCourseForm(), http.StatusUnauthorized, ""},
		{"TestAdminCanDeleteCourse", "admin", getNewCourseForm(), http.StatusNoContent, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			courseMap := test.mapKeyValues
			course := courseMap["course"].(models.Course)
			var id uint
			if test.expectedStatusCode == http.StatusNoContent {
				course, err := server.Db.CreateCourse(&course)
				if err != nil {
					t.Fatalf("unable to create course, error is %v", err)
				}
				id = course.ID
			} else {
				id = 1
			}
			req, err := http.NewRequest(http.MethodDelete, "/api/courses/{id}", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleDeleteCourse, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusNoContent {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if data.Message != "Course deleted successfully" {
					t.Errorf("handler returned wrong body: got %v want %v", data.Message, "Course deleted successfully")
				}
			}
		})
	}
}

func TestHandleUpdateCourse(t *testing.T) {
	httpTests := []httpTest{
		{"TestAdminCanUpdateCourse", "admin", getNewCourseForm(), http.StatusOK, ""},
		{"TestUserCannotUpdateCourse", "student", getNewCourseForm(), http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			courseMap := test.mapKeyValues
			course := courseMap["course"].(models.Course)
			var id uint
			if test.expectedStatusCode == http.StatusOK {
				course, err := server.Db.CreateCourse(&course)
				if err != nil {
					t.Fatalf("unable to create course, error is %v", err)
				}
				id = course.ID
				t.Cleanup(func() {
					if err := server.Db.DeleteCourse(int(id)); err != nil {
						fmt.Println("Unable to delete course. Error is: ", err)
					}
				})
			} else {
				id = 1
			}
			course.Name = "Who updated this"
			jsonForm, err := json.Marshal(course)
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPatch, "/api/courses/{id}", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleUpdateCourse, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				updatedCourse, err := server.Db.GetCourseByID(int(id))
				if err != nil {
					t.Fatalf("unable to get course from db, error is %v", err)
				}
				received := rr.Body.String()
				data := models.Resource[models.Course]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if diff := cmp.Diff(updatedCourse, &data.Data); diff != "" {
					t.Errorf("handler returned unexpected results: %v", diff)
				}
			}
		})
	}
}

func TestHandleFavoriteCourse(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCanToggleFavoriteCourseOnOff", "student", map[string]any{"id": "4", "message": "Favorite updated successfully"}, http.StatusOK, ""},
		{"TestAdminCanToggleFavoriteCourseOnOff", "admin", map[string]any{"id": "4", "message": "Favorite updated successfully"}, http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodPut, "/api/courses/{id}/save", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleFavoriteCourse, test.role)
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
				//special case here, execute another request to toggle the user's favorite
				req.SetPathValue("id", test.mapKeyValues["id"].(string))
				rr = httptest.NewRecorder()
				handler.ServeHTTP(rr, req)
				if status := rr.Code; status != http.StatusNoContent {
					t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusNoContent)
				}
			}
		})
	}
}

func getNewCourseForm() map[string]any {
	form := make(map[string]any)
	form["course"] = models.Course{
		ProviderPlatformID:      1,
		Name:                    "Justice",
		Description:             "Explore the causes.",
		ExternalID:              strconv.Itoa(rand.Intn(11000000)),
		ThumbnailURL:            "https://news.fsu.edu/wp-content/uploads/2017/11/Seal-criminology-3x2.jpg",
		Type:                    models.OpenEnrollment,
		OutcomeTypes:            "grade",
		ExternalURL:             "https://staging.canvas.unlockedlabs.xyz/courses/101",
		AltName:                 "CRJ999",
		TotalProgressMilestones: 13,
	}
	return form
}

func getCourseSearch(search string) map[string]any {
	form := make(map[string]any)
	_, courses, err := server.Db.GetCourse(1, 10, search)
	if err != nil {
		form["err"] = err
	}
	form["courses"] = courses
	return form
}
