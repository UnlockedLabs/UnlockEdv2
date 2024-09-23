package handlers

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"slices"
	"strconv"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
)

func TestHandleIndexProgramSectionEnrollments(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetAllProgramSectionEnrollmentsAsAdmin", "admin", nil, http.StatusOK, ""},
		{"TestGetAllProgramSectionEnrollmentsAsUser", "student", nil, http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/section-enrollments", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			handler := getHandlerByRole(server.handleIndexProgramSectionEnrollments, test.role)
			rr := executeRequest(t, req, handler, test)
			_, enrollments, err := server.Db.GetProgramSectionEnrollmentsForFacility(1, 10, 1)
			if err != nil {
				t.Fatalf("unable to get program section enrollments from db, error is %v", err)
			}
			data := models.PaginatedResource[models.ProgramSectionEnrollment]{}
			received := rr.Body.String()
			if err = json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("failed to unmarshal resource, error is %v", err)
			}
			for _, enrollment := range enrollments {
				if !slices.ContainsFunc(data.Data, func(enroll models.ProgramSectionEnrollment) bool {
					return enroll.ID == enrollment.ID
				}) {
					t.Error("program section enrollments not found, out of sync")
				}
			}
		})
	}
}

func TestHandleGetProgramSectionEnrollments(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetProgramSectionEnrollmentsAsAdmin", "admin", getProgramSectionEnrollmentId(1), http.StatusOK, ""},
		{"TestGetProgramSectionEnrollmentsAsUser", "student", getProgramSectionEnrollmentId(1), http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			programSectionEnrollmentsMap := test.mapKeyValues
			if programSectionEnrollmentsMap["err"] != nil {
				t.Fatalf("unable to get program section enrollment ID, error is %v", programSectionEnrollmentsMap["err"])
			}
			req, err := http.NewRequest(http.MethodGet, "/api/section-enrollments/{id}", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			id := programSectionEnrollmentsMap["id"].(uint)
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRole(server.handleGetProgramSectionEnrollments, test.role)
			rr := executeRequest(t, req, handler, test)
			enrollment, err := server.Db.GetProgramSectionEnrollmentsByID(int(id))
			if err != nil {
				t.Fatalf("unable to get program section enrollment from db, error is %v", err)
			}
			data := models.Resource[models.ProgramSectionEnrollment]{}
			received := rr.Body.String()
			if err = json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("failed to unmarshal resource, error is %v", err)
			}
			if diff := cmp.Diff(enrollment, &data.Data); diff != "" {
				t.Errorf("handler returned unexpected results: %v", diff)
			}
		})
	}
}

func TestHandleGetEnrollmentsForProgram(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetEnrollmentsForProgramAsAdmin", "admin", getProgramIdForAnEnrollment(1), http.StatusOK, ""},
		{"TestGetEnrollmentsForProgramAsUser", "student", getProgramIdForAnEnrollment(1), http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			programEnrollmentsMap := test.mapKeyValues
			if programEnrollmentsMap["err"] != nil {
				t.Fatalf("unable to get program ID for enrollment, error is %v", programEnrollmentsMap["err"])
			}
			req, err := http.NewRequest(http.MethodGet, "/api/programs/{id}/sections/enrollments", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			id := programEnrollmentsMap["id"].(uint)
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRole(server.handleGetEnrollmentsForProgram, test.role)
			rr := executeRequest(t, req, handler, test)
			_, enrollments, err := server.Db.GetProgramSectionEnrollmentssForProgram(1, 10, 1, int(id))
			if err != nil {
				t.Fatalf("unable to get program section enrollment from db, error is %v", err)
			}
			data := models.PaginatedResource[models.ProgramSectionEnrollment]{}
			received := rr.Body.String()
			if err = json.Unmarshal([]byte(received), &data); err != nil {
				t.Errorf("failed to unmarshal resource, error is %v", err)
			}
			for _, enrollment := range enrollments {
				if !slices.ContainsFunc(data.Data, func(enroll models.ProgramSectionEnrollment) bool {
					return enroll.ID == enrollment.ID
				}) {
					t.Error("program section enrollments not found, out of sync")
				}
			}
		})
	}
}

func TestHandleEnrollUser(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotEnrollUser", "student", getSectionIdForAnEnrollment(1), http.StatusUnauthorized, ""},
		{"TestAdminCanEnrollUser", "admin", getSectionIdForAnEnrollment(1), http.StatusCreated, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			sectionEnrollMap := test.mapKeyValues
			if sectionEnrollMap["err"] != nil {
				t.Fatalf("unable to section id and user id, error is %v", sectionEnrollMap["err"])
			}
			req, err := http.NewRequest(http.MethodPost, "/api/section-enrollments/{section_id}/enroll/{user_id}", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			sectionId := sectionEnrollMap["section_id"].(uint)
			userId := sectionEnrollMap["user_id"].(uint)
			req.SetPathValue("section_id", strconv.Itoa(int(sectionId)))
			req.SetPathValue("user_id", strconv.Itoa(int(userId)))
			handler := getHandlerByRoleWithMiddleware(server.handleEnrollUser, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusCreated {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if data.Message != "user enrolled" {
					t.Errorf("handler returned wrong body: got %v want %v", data.Message, "user enrolled")
				}
			}
		})
	}
}

func TestHandleDeleteProgramSectionEnrollments(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotDeleteProgramSectionEnrollments", "student", getSectionIdForAnEnrollment(1), http.StatusUnauthorized, ""},
		{"TestAdminCanDeleteProgramSectionEnrollments", "admin", getSectionIdForAnEnrollment(1), http.StatusNoContent, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			sectionEnrollMap := test.mapKeyValues
			if sectionEnrollMap["err"] != nil {
				t.Fatalf("unable to section id and user id, error is %v", sectionEnrollMap["err"])
			}
			var id uint
			if test.expectedStatusCode == http.StatusNoContent {
				sectionId := sectionEnrollMap["section_id"].(uint)
				userId := sectionEnrollMap["user_id"].(uint)
				enrollment := models.ProgramSectionEnrollment{
					SectionID: sectionId,
					UserID:    userId,
				}
				if err := server.Db.Create(&enrollment).Error; err != nil {
					t.Fatalf("failed to create program section enrollment, error is %v", err)
				}
				id = enrollment.ID
			} else {
				id = 1
			}
			req, err := http.NewRequest(http.MethodDelete, "/api/section-enrollments/{id}", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleDeleteProgramSectionEnrollments, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusNoContent {
				received := rr.Body.String()
				data := models.Resource[struct{}]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if data.Message != "Section enrollment deleted successfully" {
					t.Errorf("handler returned wrong body: got %v want %v", data.Message, "Section enrollment deleted successfully")
				}
			}
		})
	}
}

func TestHandleUpdateProgramSectionEnrollments(t *testing.T) {
	httpTests := []httpTest{
		{"TestUserCannotUpdateProgramSectionEnrollments", "student", getSectionIdForAnEnrollment(1), http.StatusUnauthorized, ""},
		{"TestAdminCanUpdateProgramSectionEnrollments", "admin", getSectionIdForAnEnrollment(1), http.StatusOK, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			sectionEnrollMap := test.mapKeyValues
			if sectionEnrollMap["err"] != nil {
				t.Fatalf("unable to section id and user id, error is %v", sectionEnrollMap["err"])
			}
			var id uint
			sectionId := sectionEnrollMap["section_id"].(uint)
			userId := sectionEnrollMap["user_id"].(uint)
			enrollment := models.ProgramSectionEnrollment{
				SectionID: sectionId,
				UserID:    userId,
			}
			if test.expectedStatusCode == http.StatusOK {
				if err := server.Db.Create(&enrollment).Error; err != nil {
					t.Fatalf("failed to create program section enrollment, error is %v", err)
				}
				id = enrollment.ID
			} else {
				id = 1
			}
			enrollment.SectionID = getSectionIdForAnEnrollment(1)["section_id"].(uint)
			jsonForm, err := json.Marshal(enrollment)
			if err != nil {
				t.Fatalf("unable to marshal form, error is %v", err)
			}
			req, err := http.NewRequest(http.MethodPatch, "/api/section-enrollments/{id}", bytes.NewBuffer(jsonForm))
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleUpdateProgramSectionEnrollments, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				updatedEnrollment, err := server.Db.GetProgramSectionEnrollmentsByID(int(id))
				if err != nil {
					t.Fatalf("unable to get program section enrollment from db, error is %v", err)
				}
				received := rr.Body.String()
				data := models.Resource[models.ProgramSectionEnrollment]{}
				if err := json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				if diff := cmp.Diff(updatedEnrollment, &data.Data, cmpopts.IgnoreFields(models.ProgramSectionEnrollment{}, "UpdatedAt")); diff != "" {
					t.Errorf("handler returned unexpected results: %v", diff)
				}
			}
		})
	}
}

func TestHandleGetProgramSectionEnrollmentsAttendance(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetProgramSectionEnrollmentsAttendanceAsAdmin", "admin", getProgramSectionEnrollmentWithAttendance(1), http.StatusOK, ""},
		{"TestGetProgramSectionEnrollmentsAttendanceAsUser", "student", getProgramSectionEnrollmentWithAttendance(1), http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			attendanceMap := test.mapKeyValues
			if attendanceMap["err"] != nil {
				t.Fatalf("unable to get program section id for attendance, error is %v", attendanceMap["err"])
			}
			req, err := http.NewRequest(http.MethodGet, "/api/section-enrollments/{id}/attendance", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			id := attendanceMap["section_enrollment_id"].(uint)
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRoleWithMiddleware(server.handleGetProgramSectionEnrollmentsAttendance, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				_, attendances, err := server.Db.GetProgramSectionEnrollmentsAttendance(1, 10, int(id))
				if err != nil {
					t.Fatalf("unable to get program enrollments attendance from db, error is %v", err)
				}
				data := models.PaginatedResource[models.ProgramSectionEventAttendance]{}
				received := rr.Body.String()
				if err = json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				for _, attendance := range attendances {
					if !slices.ContainsFunc(data.Data, func(att models.ProgramSectionEventAttendance) bool {
						return att.ID == attendance.ID
					}) {
						t.Error("program enrollments attendances not found, out of sync")
					}
				}
			}
		})
	}
}

func TestHandleGetUserEnrollments(t *testing.T) {
	httpTests := []httpTest{
		{"TestGetUserEnrollmentsAsAdmin", "admin", getUserIdForEnrollments(), http.StatusOK, ""},
		{"TestGetUserEnrollmentsAsUser", "student", map[string]any{"user_id": uint(4)}, http.StatusOK, ""},
		{"TestGetUserEnrollmentsAsUser", "student", map[string]any{"user_id": uint(5)}, http.StatusUnauthorized, ""},
	}
	for _, test := range httpTests {
		t.Run(test.testName, func(t *testing.T) {
			enrollmentMap := test.mapKeyValues
			if enrollmentMap["err"] != nil {
				t.Fatalf("unable to get user id for enrollments, error is %v", enrollmentMap["err"])
			}
			req, err := http.NewRequest(http.MethodGet, "/api/users/{id}/section-enrollments", nil)
			if err != nil {
				t.Fatalf("unable to create new request, error is %v", err)
			}
			id := enrollmentMap["user_id"].(uint)
			req.SetPathValue("id", fmt.Sprintf("%d", id))
			handler := getHandlerByRole(server.handleGetUserEnrollments, test.role)
			rr := executeRequest(t, req, handler, test)
			if test.expectedStatusCode == http.StatusOK {
				_, enrollments, err := server.Db.GetProgramSectionEnrollmentsForUser(int(id), 1, 10)
				if err != nil {
					t.Fatalf("unable to get program section enrollments from db, error is %v", err)
				}
				data := models.PaginatedResource[models.ProgramSectionEnrollment]{}
				received := rr.Body.String()
				if err = json.Unmarshal([]byte(received), &data); err != nil {
					t.Errorf("failed to unmarshal resource, error is %v", err)
				}
				for _, enrollment := range enrollments {
					if !slices.ContainsFunc(data.Data, func(enroll models.ProgramSectionEnrollment) bool {
						return enroll.ID == enrollment.ID
					}) {
						t.Error("program section enrollments not found, out of sync")
					}
				}
			}
		})
	}
}

func getUserIdForEnrollments() map[string]any {
	form := make(map[string]any)
	programSectionEnrollments := []models.ProgramSectionEnrollment{}
	if err := server.Db.Table("program_section_enrollments pse").
		Select("pse.*").
		Joins("JOIN program_sections ps ON pse.section_id = ps.id and ps.deleted_at IS NULL").
		Joins("JOIN users u ON pse.user_id = u.id and ps.deleted_at IS NULL").
		Find(&programSectionEnrollments).Error; err != nil {
		form["err"] = err
	}
	form["user_id"] = programSectionEnrollments[rand.Intn(len(programSectionEnrollments))].UserID
	return form
}

func getProgramSectionEnrollmentWithAttendance(facilityId uint) map[string]any {
	form := make(map[string]any)
	programSectionEnrollments := []models.ProgramSectionEnrollment{}
	if err := server.Db.Table("program_section_enrollments pse").
		Select("pse.*").
		Joins("JOIN program_sections ps ON pse.section_id = ps.id and ps.deleted_at IS NULL").
		Joins("join program_section_events evt ON ps.id = evt.section_id and evt.deleted_at IS NULL").
		Joins("join program_section_event_attendance att ON evt.id = att.event_id and att.deleted_at IS NULL").
		Where("ps.facility_id = ?", facilityId).
		Find(&programSectionEnrollments).Error; err != nil {
		form["err"] = err
	}
	form["section_enrollment_id"] = programSectionEnrollments[rand.Intn(len(programSectionEnrollments))].ID
	return form
}

func getProgramSectionEnrollmentId(facilityId uint) map[string]any {
	form := make(map[string]any)
	_, enrollments, err := server.Db.GetProgramSectionEnrollmentsForFacility(1, 10, facilityId)
	if err != nil {
		form["err"] = err
	}
	form["id"] = enrollments[rand.Intn(len(enrollments))].ID
	return form
}

func getProgramIdForAnEnrollment(facilityId uint) map[string]any {
	form := make(map[string]any)
	programSections := []models.ProgramSection{}
	if err := server.Db.Table("program_section_enrollments pse").
		Select("ps.*").
		Joins("JOIN program_sections ps ON pse.section_id = ps.id and ps.deleted_at IS NULL").
		Where("ps.facility_id = ?", facilityId).
		Find(&programSections).Error; err != nil {
		form["err"] = err
	}
	form["id"] = programSections[rand.Intn(len(programSections))].ProgramID
	return form
}

func getSectionIdForAnEnrollment(facilityId uint) map[string]any {
	form := make(map[string]any)
	users := []models.User{}
	if err := server.Db.Model(models.User{}).Where("facility_id = ?", facilityId).Find(&users).Error; err != nil {
		form["err"] = err
	}
	id := users[rand.Intn(len(users))].ID
	programSections := []models.ProgramSection{}
	if err := server.Db.Table("program_section_enrollments pse").
		Select("ps.*").
		Joins("JOIN program_sections ps ON pse.section_id = ps.id and ps.deleted_at IS NULL").
		Joins("JOIN users u ON pse.user_id = u.id and ps.deleted_at IS NULL").
		Where("pse.user_id <> ?", id).
		Find(&programSections).Error; err != nil {
		form["err"] = err
	}
	form["section_id"] = programSections[rand.Intn(len(programSections))].ID
	form["user_id"] = id
	return form
}
