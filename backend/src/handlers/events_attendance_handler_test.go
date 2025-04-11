package handlers

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"slices"
	"strconv"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
)

// THIS Handler may be reworked as the actual handler doesn't seem finished
func TestHandleGetAttendeesForClass(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetAttendeesForClassAsAdmin", "admin", nil, http.StatusOK, getQueryParamsForAttendees()},
		{"TestGetAttendeesForClassAsUser", "student", nil, http.StatusUnauthorized, getQueryParamsForAttendees()},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/program-classes/{id}/attendees%s", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", 5)) //static...doesn't use 5
			handler := getHandlerByRoleWithMiddleware(server.handleGetAttendeesForClass, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				attendees, err := server.Db.GetAttendees(1, 10, req.URL.Query(), 5) //static doesn't use 5
				if err != nil {
					t.Fatalf("unable to get attendees from db, error is %v", err)
				}
				data := models.PaginatedResource[models.ProgramClassEventAttendance]{}
				received := rr.Body.String()
				if err = json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				for _, attendee := range attendees {
					if !slices.ContainsFunc(data.Data, func(att models.ProgramClassEventAttendance) bool {
						return att.ID == attendee.ID
					}) {
						t.Error("attendees not found, out of sync")
					}
				}
			}
		})
	}
}

func TestHandleLogAttendeeForEvent(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotLogAttendeeForEvent", "student", getIdsForLogAttendee(), http.StatusUnauthorized, ""},
		{"TestAdminCanLogAttendeeForEvent", "admin", getIdsForLogAttendee(), http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			logAttendeeMap := test.mapKeyValues
			if logAttendeeMap["err"] != nil {
				t.Fatalf("unable get event id and user id for log attendee, error is %v", logAttendeeMap["err"])
			}
			req, err := http.NewRequest(http.MethodPost, fmt.Sprint("/api/events/{id}/attendee", test.queryParams), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			eventId := logAttendeeMap["event_id"].(uint)
			userId := logAttendeeMap["user_id"].(uint)
			date, ok := logAttendeeMap["date"].(string)
			if !ok || date == "" {
				date = time.Now().Format("2006-01-02")
			}

			attendance_status := logAttendeeMap["attendance_status"].(models.Attendance)

			attendancePayload := models.ProgramClassEventAttendance{
				EventID:          eventId,
				UserID:           userId,
				Date:             date,
				AttendanceStatus: models.Attendance(attendance_status),
			}
			payloadBytes, err := json.Marshal(attendancePayload)
			if err != nil {
				t.Fatalf("unable to marshal JSON payload: %v", err)
			}
			req.Body = io.NopCloser(bytes.NewReader(payloadBytes))

			handler := getHandlerByRoleWithMiddleware(server.handleLogAttendeeForEvent, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				att := &models.ProgramClassEventAttendance{
					EventID:          eventId,
					UserID:           userId,
					Date:             date,
					AttendanceStatus: models.Present,
				}
				received := rr.Body.String()
				data := models.Resource[models.ProgramClassEventAttendance]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if diff := cmp.Diff(att, &data.Data, cmpopts.IgnoreFields(models.ProgramClassEventAttendance{}, "ID", "CreatedAt", "UpdatedAt")); diff != "" {
					t.Errorf("handler returned unexpected results: %v", diff)
				}

			}
		})
	}
}

func TestHandleDeleteAttendee(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotDeleteAttendee", "student", getIdsForLogAttendee(), http.StatusUnauthorized, "?date=%v"},
		{"TestAdminCanDeleteAttendee", "admin", getIdsForLogAttendee(), http.StatusNoContent, "?date=%v"},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			logAttendeeMap := test.mapKeyValues
			if logAttendeeMap["err"] != nil {
				t.Fatalf("unable get event id and user id for log attendee, error is %v", logAttendeeMap["err"])
			}
			req, err := http.NewRequest(http.MethodDelete, fmt.Sprintf("/api/events/{id}/attendees/{user_id}%s", fmt.Sprintf(test.queryParams, logAttendeeMap["date"].(string))), nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			eventId := logAttendeeMap["event_id"].(uint)
			userId := logAttendeeMap["user_id"].(uint)
			req.SetPathValue("id", strconv.Itoa(int(eventId)))
			req.SetPathValue("user_id", strconv.Itoa(int(userId)))
			handler := getHandlerByRoleWithMiddleware(server.handleDeleteAttendee, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusNoContent {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if data.Message != "success" {
					t.Errorf("handler returned wrong body: got %v want %v", data.Message, "success")
				}
			}
		})
	}
}

func getQueryParamsForAttendees() string {
	attendances := []models.ProgramClassEventAttendance{}
	if err := server.Db.Model(&models.ProgramClassEventAttendance{}).Find(&attendances).Error; err != nil {
		return "" //do not crash
	}
	attendance := attendances[rand.Intn(len(attendances))]
	queryString := fmt.Sprintf("?date=%v&user_id=%d&event_id=%d", attendance.Date, attendance.UserID, attendance.EventID) //
	return queryString
}

func getIdsForLogAttendee() map[string]any {
	form := make(map[string]any)
	attendances := []models.ProgramClassEventAttendance{}
	if err := server.Db.Model(&models.ProgramClassEventAttendance{}).Find(&attendances).Error; err != nil {
		form["err"] = err
	}
	attendance := attendances[rand.Intn(len(attendances))]
	form["event_id"] = attendance.EventID
	form["user_id"] = attendance.UserID
	form["date"] = attendance.Date
	form["attendance_status"] = models.Present
	return form
}
