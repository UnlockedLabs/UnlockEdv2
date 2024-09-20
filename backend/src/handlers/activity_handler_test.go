package handlers

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"slices"
	"strconv"
	"testing"
	"time"
)

// fails on query...fix this when needed.
// func TestHandleGetActivityByUserID(t *testing.T) {
// 	httpTests := []httpTest{
// 		{"TestGetActivityByUserIDAsAdmin", "admin", map[string]any{"id": "1", "year": 2023}, http.StatusOK, "?year=2023"},
// 		{"TestGetActivityByUserIDAsUser", "student", map[string]any{"id": "4", "year": 2023}, http.StatusOK, "?year=2023"},
// 	}
// 	for _, test := range httpTests {
// 		t.Run(test.testName, func(t *testing.T) {
// 			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/users/{id}/activity%s", test.queryParams), nil)
// 			if err != nil {
// 				t.Fatal(err)
// 			}
// 			req.SetPathValue("id", test.mapKeyValues["id"].(string))
// 			handler := getHandlerByRole(server.handleGetActivityByUserID, test.role)
// 			rr := executeRequest(t, req, handler, test)
// 			id, _ := strconv.Atoi(test.mapKeyValues["id"].(string))
// 			year, _ := strconv.Atoi(test.mapKeyValues["year"].(string))
// 			dailyActivities, err := server.Db.GetActivityByUserID(uint(id), year)
// 			if err != nil {
// 				t.Fatal("failed to get activities by user id, error is ", err)
// 			}
// 			received := rr.Body.String()
// 			resource := models.Resource[map[string]interface{}]{}
// 			if err := json.Unmarshal([]byte(received), &resource); err != nil {
// 				t.Errorf("failed to unmarshal user dashboard")
// 			}
// 			jsonStr, err := json.Marshal(resource.Data["activities"])
// 			if err != nil {
// 				t.Error("unable to marshal response user programs, error is ", err)
// 			}
// 			responseActivities := []database.DailyActivity{}
// 			err = json.Unmarshal(jsonStr, &responseActivities)
// 			if err != nil {
// 				t.Error("unable to unmarshal response user programs, error is ", err)
// 			}

// 			for _, dailyActivity := range dailyActivities {
// 				if !slices.ContainsFunc(responseActivities, func(dailyAct database.DailyActivity) bool {
// 					isGood := true
// 					for _, activity := range dailyActivity.Activities {
// 						if !slices.ContainsFunc(dailyAct.Activities, func(act models.Activity) bool {
// 							return act.ID == activity.ID
// 						}) {
// 							isGood = false
// 							break
// 						}
// 					}
// 					return dailyAct.Date == dailyActivity.Date && isGood
// 				}) {
// 					t.Error("facilities not found, out of sync")
// 				}
// 			}
// 		})
// 	}
// }

func TestHandleGetDailyActivityByUserID(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetGetDailyActivityByUserIDAsAdmin", "admin", map[string]any{"id": "4", "year": 2023}, http.StatusOK, "?year=2023"},
		{"TestGetDailyActivityByUserIDAsUser", "student", map[string]any{"id": "4", "year": 2023}, http.StatusOK, "?year=2023"},
		{"TestGetDailyActivityByAnotherUserIDAsDifferentUser", "student", map[string]any{"id": "5", "year": 2023}, http.StatusForbidden, "?year=2023"},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/users/{id}/daily-activity%s", test.queryParams), nil)
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRole(server.handleGetDailyActivityByUserID, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				id, _ := strconv.Atoi(test.mapKeyValues["id"].(string))
				dailyActivities, err := server.Db.GetDailyActivityByUserID(id, test.mapKeyValues["year"].(int))
				if err != nil {
					t.Fatal("failed to get daily activities by user id and year, error is ", err)
				}
				received := rr.Body.String()
				resource := models.Resource[map[string]interface{}]{}
				if err := json.Unmarshal([]byte(received), &resource); err != nil {
					t.Errorf("failed to unmarshal daily activities")
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

func TestHandleGetProgramActivity(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetProgramActivityAsAdmin", "admin", map[string]any{"id": "4"}, http.StatusOK, ""},
		{"TestGetProgramActivityAsUser", "student", map[string]any{"id": "4"}, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/programs/{id}/activity", nil)
			if err != nil {
				t.Fatal(err)
			}
			req.SetPathValue("id", test.mapKeyValues["id"].(string))
			handler := getHandlerByRoleWithMiddleware(server.handleGetProgramActivity, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				id, _ := strconv.Atoi(test.mapKeyValues["id"].(string))
				count, activities, err := server.Db.GetActivityByProgramID(1, 10, id)
				if err != nil {
					t.Fatal("failed to get activities by program id and year, error is ", err)
				}
				received := rr.Body.String()
				resource := models.Resource[map[string]interface{}]{}
				if err := json.Unmarshal([]byte(received), &resource); err != nil {
					t.Errorf("failed to unmarshal activities by program id")
				}
				jsonStr, err := json.Marshal(resource.Data["activities"])
				if err != nil {
					t.Error("unable to marshal response activities by program id, error is ", err)
				}
				responseActivities := []models.Activity{}
				err = json.Unmarshal(jsonStr, &responseActivities)
				if err != nil {
					t.Error("unable to unmarshal response activities by program id, error is ", err)
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

//uses function call to create an activity
// func TestHandleCreateActivity(t *testing.T) {
// 	httpTests := []httpTest{
// 		{"TestAdminCanCreateActivity", "admin", getNewActivityForm(), http.StatusOK, ""},
// 		{"TestUserCannotCreateActivity", "student", getNewActivityForm(), http.StatusUnauthorized, ""},
// 	}
// 	for _, test := range httpTests {
// 		t.Run(test.testName, func(t *testing.T) {
// 			activityMap := test.mapKeyValues
// 			if activityMap["err"] != nil {
// 				t.Fatal("unable to create activity form, error is ", activityMap["err"])
// 			}
// 			jsonForm, err := json.Marshal(activityMap)
// 			if err != nil {
// 				t.Errorf("failed to marshal form")
// 			}
// 			req, err := http.NewRequest(http.MethodPost, "/api/users/{id}/activity", bytes.NewBuffer(jsonForm))
// 			if err != nil {
// 				t.Fatal(err)
// 			}
// 			handler := getHandlerByRoleWithMiddleware(server.handleCreateActivity, test.role)
// 			rr := executeRequest(t, req, handler, test)
// 			if test.expectedStatusCode == http.StatusOK {
// 				received := rr.Body.String()
// 				data := models.Resource[models.Activity]{}
// 				if err := json.Unmarshal([]byte(received), &data); err != nil {
// 					t.Errorf("failed to unmarshal response error is %v", err)
// 				}
// 				activity := &models.Activity{}
// 				if err := server.Db.First(activity, data.Data.ID).Error; err != nil {
// 					t.Fatalf("unable to get activity from db, error is %v", err)
// 				}
// 				t.Cleanup(func() {
// 					err := server.Db.Delete(&models.Activity{}, data.Data.ID).Error
// 					if err != nil {
// 						fmt.Println("error running clean for milestone that was created, error is ", err)
// 					}
// 				})
// 				if diff := cmp.Diff(activity, &data.Data); diff != "" {
// 					t.Errorf("handler returned unexpected results: %v", diff)
// 				}
// 			}
// 		})
// 	}
// }

func getNewActivityForm() map[string]any {
	form := make(map[string]any)
	_, programs, err := server.Db.GetProgram(1, 10, "")
	if err != nil {
		form["err"] = err
	}
	_, users, err := server.Db.GetCurrentUsers(1, 10, 1, "", "")
	if err != nil {
		form["err"] = err
	}
	//logic from test seeder
	startTime := 0
	randTime := rand.Intn(1000)
	yearAgo := time.Now().AddDate(-1, 0, 0)
	time := yearAgo.AddDate(0, 0, 10)
	form["user_id"] = users[rand.Intn(len(users))].ID
	form["program_id"] = programs[rand.Intn(len(programs))].ID
	form["type"] = "interaction"
	form["total_time"] = uint(startTime + randTime)
	form["time_delta"] = uint(randTime)
	form["external_content_id"] = strconv.Itoa(rand.Intn(10000))
	form["created_at"] = time
	return form
}
