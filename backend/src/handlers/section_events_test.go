package handlers

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"slices"
	"strconv"
	"testing"
	"time"

	"github.com/teambition/rrule-go"
)

func TestHandleGetAdminCalendar(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetAdminCalendarAsAdmin", "admin", map[string]any{"month": "", "year": ""}, http.StatusOK, ""},
		{"TestGetAdminCalendarAsUser", "student", map[string]any{"month": "", "year": ""}, http.StatusUnauthorized, ""},
		{"TestGetAdminCalendarAsAdmin", "admin", map[string]any{"month": "09", "year": "2023"}, http.StatusOK, "?month=09&year=2023"},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/admin-calendar%s", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRoleWithMiddleware(server.handleGetAdminCalendar, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				var monthNum int
				var year int
				if test.mapKeyValues["month"].(string) != "" {
					monthNum, _ = strconv.Atoi(test.mapKeyValues["month"].(string))
					year, _ = strconv.Atoi(test.mapKeyValues["year"].(string))
				} else {
					now := time.Now()
					year, _ = strconv.Atoi(now.Format("2006"))
					monthNum, _ = strconv.Atoi(now.Format("01"))
				}
				calendar, err := server.Db.GetCalendar(time.Month(monthNum), year, 1, nil)
				if err != nil {
					t.Errorf("failed to get admin calendar from db, error is %v", err)
				}
				data := models.Resource[models.Calendar]{}
				received := rr.Body.String()
				if err = json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				var datesEqual bool
				var eventsEqual bool
				for _, day := range calendar.Month.Days {
					if !slices.ContainsFunc(data.Data.Month.Days, func(d models.Day) bool {
						datesEqual = day.Date.Equal(d.Date)
						if datesEqual {
							eventsEqual = true
							for _, event := range day.Events {
								if !slices.ContainsFunc(d.Events, func(evt models.EventInstance) bool {
									return evt.EventID == event.EventID
								}) {
									eventsEqual = false
									break
								}
							}
						}
						return datesEqual && eventsEqual
					}) {
						t.Error("calendars do not match and are out of sync")
					}
				}
			}
		})
	}
}

func TestHandleGetStudentCalendar(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetStudentCalendarAsAdmin", "admin", map[string]any{"month": "", "year": "", "user_id": 1}, http.StatusOK, ""},
		{"TestGetStudentCalendarAsUser", "student", map[string]any{"month": "", "year": "", "user_id": 4}, http.StatusOK, ""},
		{"TestGetStudentCalendarAsUser", "student", map[string]any{"month": "10", "year": "2024", "user_id": 4}, http.StatusOK, "?month=10&year=2024"},
		{"TestGetStudentCalendarAsUser", "studen", map[string]any{"month": "09", "year": "2023", "user_id": 4}, http.StatusOK, "?month=09&year=2023"},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/student-calendar%s", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRole(server.handleGetStudentCalendar, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				var monthNum int
				var year int
				if test.mapKeyValues["month"].(string) != "" {
					monthNum, _ = strconv.Atoi(test.mapKeyValues["month"].(string))
					year, _ = strconv.Atoi(test.mapKeyValues["year"].(string))
				} else {
					now := time.Now()
					year, _ = strconv.Atoi(now.Format("2006"))
					monthNum, _ = strconv.Atoi(now.Format("01"))
				}
				userId := uint(test.mapKeyValues["user_id"].(int))
				calendar, err := server.Db.GetCalendar(time.Month(monthNum), year, 1, &userId)
				if err != nil {
					t.Errorf("failed to get user calendar from db, error is %v", err)
				}
				data := models.Resource[models.Calendar]{}
				received := rr.Body.String()
				if err = json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if data.Data.Month.Name != calendar.Month.Name {
					t.Errorf("calendars do not match, got %v want %v", data.Data.Month.Name, calendar.Month.Name)
				}
				var datesEqual bool
				var eventsEqual bool
				for _, day := range calendar.Month.Days {
					if !slices.ContainsFunc(data.Data.Month.Days, func(d models.Day) bool {
						datesEqual = day.Date.Equal(d.Date)
						if datesEqual {
							eventsEqual = true
							for _, event := range day.Events {
								if !slices.ContainsFunc(d.Events, func(evt models.EventInstance) bool {
									return evt.EventID == event.EventID
								}) {
									eventsEqual = false
									break
								}
							}
						}
						return datesEqual && eventsEqual
					}) {
						t.Error("calendars do not match and are out of sync")
					}
				}
			}

		})
	}
}

func TestHandleEventOverride(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotEventOverride", "student", getOverideForm(1), http.StatusUnauthorized, ""},
		{"TestAdminCanEventOverride", "admin", getOverideForm(1), http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			overrideMap := test.mapKeyValues
			if overrideMap["err"] != nil {
				t.Fatalf("unable to build override event, error is %v", overrideMap["err"])
			}
			jsonForm, err := json.Marshal(overrideMap["override"])
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPut, "/api/events/{event_id}", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			id := overrideMap["event_id"].(uint)
			req.SetPathValue("event_id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleEventOverride, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusCreated {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if data.Message != "Override created successfully" {
					t.Errorf("handler returned wrong body: got %v want %v", data.Message, "Override created successfully")
				}
			} //left this here in case calendar is returned...have something ready
			// if test.expectedStatusCode == http.StatusCreated {
			// 	received := rr.Body.String()
			// calendar, err := server.Db.GetCalendar(time.Month(monthNum), year, 1, &userId)
			// if err != nil {
			// 	t.Errorf("failed to get user calendar from db, error is %v", err)
			// }
			// data := models.Resource[models.Calendar]{}
			// received := rr.Body.String()
			// if err = json.Unmarshal([]byte(received), &data); err != nil {
			// t.Errorf("failed to unmarshal resource, error is %v", err)
			// }
			// if diff := cmp.Diff(calendar, &data.Data); diff != "" {
			// 	t.Errorf("handler returned unexpected response body: %v", diff)
			// }
		})
	}
}

func TestHandleCreateEvent(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotCreateEvent", "student", getProgramSectionEvent(1), http.StatusUnauthorized, ""},
		{"TestAdminCanCreateEvent", "admin", getProgramSectionEvent(1), http.StatusCreated, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			sectionEventMap := test.mapKeyValues
			if sectionEventMap["err"] != nil {
				t.Fatalf("unable to build program section event, error is %v", sectionEventMap["err"])
			}
			jsonForm, err := json.Marshal(sectionEventMap["sectionEvent"])
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPost, "/api/program-sections/{id}/events", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			id := sectionEventMap["section_id"].(uint)
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleCreateEvent, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusCreated {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if data.Message != "Event created successfully" {
					t.Errorf("handler returned wrong body: got %v want %v", data.Message, "Event created successfully")
				}
			}
		})
	}
}

func TestHandleGetStudentAttendanceData(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetStudentAttendanceDataAsAdmin", "admin", map[string]any{"id": "1"}, http.StatusOK, ""},
		{"TestGetStudentAttendanceDataAsUser", "student", map[string]any{"id": "4"}, http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/student-attendance", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			id, _ := strconv.Atoi(test.mapKeyValues["id"].(string))
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRole(server.handleGetStudentAttendanceData, test.role)
			rr := executeRequest(t, req, handler, test)
			programDataList, err := server.Db.GetStudentProgramAttendanceData(uint(id))
			if err != nil {
				t.Fatalf("unable to get student program attendance data from db, error is %v", err)
			}
			data := models.Resource[[]database.ProgramData]{}
			received := rr.Body.String()
			if err = json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("failed to unmarshal resource, error is %v", err)
			}
			var programsEqual bool
			var attendedEqual bool
			for _, programData := range programDataList {
				if !slices.ContainsFunc(data.Data, func(progData database.ProgramData) bool {
					programsEqual = progData.ProgramID == programData.ProgramID
					if programsEqual {
						attendedEqual = true
						for _, eventAtt := range programData.AttendanceRecords {
							if !slices.ContainsFunc(progData.AttendanceRecords, func(evtAtt models.ProgramSectionEventAttendance) bool {
								return evtAtt.EventID == eventAtt.EventID
							}) {
								attendedEqual = false
								break
							}
						}
					}
					return programsEqual && attendedEqual
				}) {
					t.Error("provider user mappings not found, out of sync")
				}
			}
		})
	}
}

func getOverideForm(facilityId uint) map[string]any {
	form := make(map[string]any)
	args := getDefaultQueryCtx()
	args.FacilityID = facilityId
	sections, err := server.Db.GetSectionsForFacility(&args)
	if err != nil {
		form["err"] = err
	}
	for {
		_, events, err := server.Db.GetSectionEvents(1, 10, int(sections[rand.Intn(len(sections))].ID))
		if err != nil {
			form["err"] = err
			break
		}
		if len(events) > 0 {
			form["event_id"] = events[rand.Intn(len(events))].ID
			break
		}
	}
	form["override"] = models.OverrideForm{
		Date:         time.Date(2024, 9, 1, 0, 0, 0, 0, time.UTC).Format("2006-01-02"),
		StartTime:    time.Now().Format("2006-01-02"),
		Duration:     "3h30m0s",
		IsCancelled:  false,
		OverrideType: models.OverrideForwards,
	}
	return form
}

func buildStaticRRule() (*rrule.RRule, error) {
	daysMap := map[int]rrule.Weekday{0: rrule.TU, 1: rrule.WE, 2: rrule.TH, 3: rrule.FR, 4: rrule.SA, 5: rrule.SU, 6: rrule.MO}
	rule, err := rrule.NewRRule(rrule.ROption{ //orig
		Freq:      rrule.WEEKLY,
		Dtstart:   time.Now().Add(time.Duration(time.Month(rand.Intn(11)))),
		Count:     100,
		Byweekday: []rrule.Weekday{daysMap[rand.Intn(7)]},
	})
	return rule, err
}

func getProgramSectionEvent(facilityId uint) map[string]any {
	form := make(map[string]any)
	args := getDefaultQueryCtx()
	args.FacilityID = facilityId
	sections, err := server.Db.GetSectionsForFacility(&args)
	if err != nil {
		form["err"] = err
	}
	rule, err := buildStaticRRule()
	if err != nil {
		form["err"] = err
	}
	id := sections[rand.Intn(len(sections))].ID
	form["section_id"] = id
	form["sectionEvent"] = models.ProgramSectionEvent{
		SectionID:      id,
		RecurrenceRule: rule.String(),
		Room:           "TBD",
		Duration:       "2h45m0s",
	}
	return form
}
