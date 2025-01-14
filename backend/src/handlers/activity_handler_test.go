package handlers

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestHandleGetDailyActivityByUserID(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetDailyActivityByUserIDAsAdmin", "admin", map[string]any{"id": "4", "start_date": "2023-01-01T00:00:00Z", "end_date": "2023-01-07T00:00:00Z"}, http.StatusOK, "?start_date=2023-01-01T00:00:00Z&end_date=2023-01-07T00:00:00Z"},
		{"TestGetDailyActivityByUserIDAsUser", "student", map[string]any{"id": "4", "start_date": "2023-01-01T00:00:00Z", "end_date": "2023-01-07T00:00:00Z"}, http.StatusOK, "?start_date=2023-01-01T00:00:00Z&end_date=2023-01-07T00:00:00Z"},
		{"TestGetDailyActivityByAnotherUserIDAsDifferentUser", "student", map[string]any{"id": "5", "start_date": "2023-01-01T00:00:00Z", "end_date": "2023-01-07T00:00:00Z"}, http.StatusForbidden, "?start_date=2023-01-01T00:00:00Z&end_date=2023-01-07T00:00:00Z"},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/users/{id}/daily-activity%s", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			// test
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleGetDailyActivityByUserID, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				id, _ := strconv.Atoi(test.mapKeyValues["id"].(string))
				startDate, err := time.Parse("2006-01-02", strings.Split(test.mapKeyValues["start_date"].(string), "T")[0])
				if err != nil {
					t.Fatalf("unable to parse start date, error is %v", err)
				}
				endDate, err := time.Parse("2006-01-02", strings.Split(test.mapKeyValues["end_date"].(string), "T")[0])
				if err != nil {
					t.Fatalf("unable to parse start date, error is %v", err)
				}
				dailyActivities, err := server.Db.GetDailyActivityByUserID(id, startDate, endDate)
				if err != nil {
					t.Fatal("unable to get daily activities by user id and year, error is ", err)
				}
				received := rr.Body.String()
				resource := models.Resource[map[string]interface{}]{}
				if err := json.Unmarshal([]byte(received), &resource); err != nil {
					t.Errorf("unable to unmarshal resource, error is %v", err)
				}
				jsonStr, err := json.Marshal(resource.Data["activities"])
				if err != nil {
					t.Error("unable to marshal response daily activities, error is ", err)
				}
				responseActivities := []database.DailyActivity{}
				err = json.Unmarshal(jsonStr, &responseActivities)
				if err != nil {
					t.Error("unable to unmarshal response daily activities, error is ", err)
				}
				for _, dailyActivity := range dailyActivities {
					if !slices.ContainsFunc(responseActivities, func(dailyAct database.DailyActivity) bool {
						isGood := true
						for _, activity := range dailyActivity.Activities {
							if !slices.ContainsFunc(dailyAct.Activities, func(act models.Activity) bool {
								return act.ID == activity.ID
							}) {
								isGood = false
								break
							}
						}
						return dailyAct.Date == dailyActivity.Date && isGood
					}) {
						t.Error("user daily activities not found, out of sync")
					}
				}

			}

		})
	}
}

func TestHandleGetCourseActivity(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetGetCourseActivityAsAdmin", "admin", map[string]any{"id": "4"}, http.StatusOK, ""},
		{"TestGetGetCourseActivityAsUser", "student", map[string]any{"id": "4"}, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/courses/{id}/activity", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRoleWithMiddleware(server.handleGetCourseActivity, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				id, _ := strconv.Atoi(test.mapKeyValues["id"].(string))
				count, activities, err := server.Db.GetActivityByCourseID(1, 10, id)
				if err != nil {
					t.Fatal("unable to get activities by course id and year, error is ", err)
				}
				received := rr.Body.String()
				resource := models.Resource[map[string]interface{}]{}
				if err := json.Unmarshal([]byte(received), &resource); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				jsonStr, err := json.Marshal(resource.Data["activities"])
				if err != nil {
					t.Error("unable to marshal response activities by course id, error is ", err)
				}
				responseActivities := []models.Activity{}
				err = json.Unmarshal(jsonStr, &responseActivities)
				if err != nil {
					t.Error("unable to unmarshal response activities by course id, error is ", err)
				}
				if float64(count) != resource.Data["count"].(float64) {
					t.Errorf("unexpected response got %v want %v ", resource.Data["count"], count)
				}
				for _, dailyActivity := range activities {
					if !slices.ContainsFunc(responseActivities, func(dailyAct models.Activity) bool {
						return dailyAct.ID == dailyActivity.ID
					}) {
						t.Error("user daily activities not found, out of sync")
					}
				}

			}

		})
	}
}
