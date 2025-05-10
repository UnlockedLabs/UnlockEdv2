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

func TestHandleCreateEvent(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotCreateEvent", "student", getProgramClassEvent(1), http.StatusUnauthorized, ""},
		{"TestAdminCanCreateEvent", "admin", getProgramClassEvent(1), http.StatusCreated, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			classEventMap := test.mapKeyValues
			if classEventMap["err"] != nil {
				t.Fatalf("unable to build program class event, error is %v", classEventMap["err"])
			}
			jsonForm, err := json.Marshal(classEventMap["classEvent"])
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPost, "/api/program-classes/{id}/events", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			id := classEventMap["class_id"].(uint)
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
							if !slices.ContainsFunc(progData.AttendanceRecords, func(evtAtt models.ProgramClassEventAttendance) bool {
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

func getProgramClassEvent(facilityId uint) map[string]any {
	form := make(map[string]any)
	args := getDefaultQueryCtx()
	args.FacilityID = facilityId
	classes, err := server.Db.GetClassesForFacility(&args)
	if err != nil {
		form["err"] = err
	}
	rule, err := buildStaticRRule()
	if err != nil {
		form["err"] = err
	}
	id := classes[rand.Intn(len(classes))].ID
	form["class_id"] = id
	form["classEvent"] = models.ProgramClassEvent{
		ClassID:        id,
		RecurrenceRule: rule.String(),
		Room:           "TBD",
		Duration:       "2h45m0s",
	}
	return form
}
