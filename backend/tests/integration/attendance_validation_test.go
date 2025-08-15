package integration

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"UnlockEdv2/src/handlers"
	"UnlockEdv2/src/models"

	"github.com/stretchr/testify/require"
)

// - POST /api/program-classes/{class_id}/events/{event_id}/attendance
// - DELETE /api/program-classes/{class_id}/events/{event_id}/attendance/{user_id}
func TestAttendanceValidation(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Test Facility")
	require.NoError(t, err)

	facilityAdmin, err := env.CreateTestUser("testadmin", models.FacilityAdmin, facility.ID, "")
	require.NoError(t, err)

	enrolledStudent, err := env.CreateTestUser("enrolledstudent", models.Student, facility.ID, "STU001")
	require.NoError(t, err)

	unenrolledStudent, err := env.CreateTestUser("unenrolledstudent", models.Student, facility.ID, "STU002")
	require.NoError(t, err)

	program, err := env.CreateTestProgram("Test Program", models.FundingType(models.FederalGrants), []models.ProgramType{}, []models.ProgramCreditType{}, true, nil)
	require.NoError(t, err)

	err = env.SetFacilitiesToProgram(program.ID, []uint{facility.ID})
	require.NoError(t, err)

	class, err := env.CreateTestClass(program, facility, models.Active)
	require.NoError(t, err)

	event, err := env.CreateTestEvent(class.ID, "")
	require.NoError(t, err)

	_, err = env.CreateTestEnrollment(class.ID, enrolledStudent.ID, models.Enrolled)
	require.NoError(t, err)

	cancelledDate := time.Now().AddDate(0, 0, -1).Format("2006-01-02") // yesterday (past date)
	_, err = env.CreateTestEventOverride(event.ID, cancelledDate, true, "cancelled")
	require.NoError(t, err)

	t.Run("POST Attendance Validation", func(t *testing.T) {
		testPOSTAttendanceValidation(t, env, facilityAdmin, class, event, enrolledStudent, unenrolledStudent, cancelledDate)
	})

	t.Run("DELETE Attendance Validation", func(t *testing.T) {
		testDELETEAttendanceValidation(t, env, facilityAdmin, class, event, enrolledStudent, unenrolledStudent, cancelledDate)
	})
}

func testPOSTAttendanceValidation(t *testing.T, env *TestEnv, admin *models.User, class *models.ProgramClass, event *models.ProgramClassEvent, enrolledStudent, unenrolledStudent *models.User, cancelledDate string) {
	validDate := time.Now().AddDate(0, 0, -2).Format("2006-01-02") // day before yesterday

	t.Run("Reject attendance for cancelled date", func(t *testing.T) {
		attendanceData := []models.ProgramClassEventAttendance{
			{
				UserID:           enrolledStudent.ID,
				Date:             cancelledDate,
				AttendanceStatus: models.Present,
				Note:             "Test attendance",
			},
		}

		NewRequest[any](env.Client, t, http.MethodPost,
			fmt.Sprintf("/api/program-classes/%d/events/%d/attendance", class.ID, event.ID),
			attendanceData).
			WithTestClaims(&handlers.Claims{
				Role:       models.FacilityAdmin,
				FacilityID: admin.FacilityID,
			}).
			Do().
			ExpectStatus(http.StatusConflict).
			ExpectBodyContains("cannot record attendance for cancelled class date")
	})

	t.Run("Reject attendance for unenrolled user", func(t *testing.T) {
		attendanceData := []models.ProgramClassEventAttendance{
			{
				UserID:           unenrolledStudent.ID,
				Date:             validDate,
				AttendanceStatus: models.Present,
				Note:             "Test attendance",
			},
		}

		NewRequest[any](env.Client, t, http.MethodPost,
			fmt.Sprintf("/api/program-classes/%d/events/%d/attendance", class.ID, event.ID),
			attendanceData).
			WithTestClaims(&handlers.Claims{
				Role:       models.FacilityAdmin,
				FacilityID: admin.FacilityID,
			}).
			Do().
			ExpectStatus(http.StatusBadRequest).
			ExpectBodyContains(fmt.Sprintf("user %d is not enrolled in class %d", unenrolledStudent.ID, class.ID))
	})

	t.Run("Accept valid attendance for enrolled user on valid date", func(t *testing.T) {
		attendanceData := []models.ProgramClassEventAttendance{
			{
				UserID:           enrolledStudent.ID,
				Date:             validDate,
				AttendanceStatus: models.Present,
				Note:             "Valid attendance",
			},
		}

		NewRequest[any](env.Client, t, http.MethodPost,
			fmt.Sprintf("/api/program-classes/%d/events/%d/attendance", class.ID, event.ID),
			attendanceData).
			WithTestClaims(&handlers.Claims{
				Role:       models.FacilityAdmin,
				FacilityID: admin.FacilityID,
			}).
			Do().
			ExpectStatus(http.StatusOK).
			ExpectBodyContains("Attendance updated")
	})

	t.Run("Reject multiple users with mixed enrollment status", func(t *testing.T) {
		attendanceData := []models.ProgramClassEventAttendance{
			{
				UserID:           enrolledStudent.ID,
				Date:             validDate,
				AttendanceStatus: models.Present,
				Note:             "Enrolled student",
			},
			{
				UserID:           unenrolledStudent.ID,
				Date:             validDate,
				AttendanceStatus: models.Present,
				Note:             "Unenrolled student",
			},
		}

		NewRequest[any](env.Client, t, http.MethodPost,
			fmt.Sprintf("/api/program-classes/%d/events/%d/attendance", class.ID, event.ID),
			attendanceData).
			WithTestClaims(&handlers.Claims{
				Role:       models.FacilityAdmin,
				FacilityID: admin.FacilityID,
			}).
			Do().
			ExpectStatus(http.StatusBadRequest).
			ExpectBodyContains(fmt.Sprintf("user %d is not enrolled in class %d", unenrolledStudent.ID, class.ID))
	})
}

func testDELETEAttendanceValidation(t *testing.T, env *TestEnv, admin *models.User, class *models.ProgramClass, event *models.ProgramClassEvent, enrolledStudent, unenrolledStudent *models.User, cancelledDate string) {
	validDate := time.Now().AddDate(0, 0, -2).Format("2006-01-02") // day before yesterday

	attendanceData := []models.ProgramClassEventAttendance{
		{
			EventID:          event.ID,
			UserID:           enrolledStudent.ID,
			Date:             validDate,
			AttendanceStatus: models.Present,
			Note:             "To be deleted",
		},
	}
	err := env.DB.LogUserAttendance(attendanceData)
	require.NoError(t, err)

	t.Run("Reject delete attendance for cancelled date", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodDelete,
			fmt.Sprintf("/api/program-classes/%d/events/%d/attendance/%d?date=%s", class.ID, event.ID, enrolledStudent.ID, cancelledDate), nil).
			WithTestClaims(&handlers.Claims{
				Role:       models.FacilityAdmin,
				FacilityID: admin.FacilityID,
			}).
			Do().
			ExpectStatus(http.StatusConflict).
			ExpectBodyContains("cannot delete attendance for cancelled class date")
	})

	t.Run("Reject delete attendance for unenrolled user", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodDelete,
			fmt.Sprintf("/api/program-classes/%d/events/%d/attendance/%d?date=%s", class.ID, event.ID, unenrolledStudent.ID, validDate), nil).
			WithTestClaims(&handlers.Claims{
				Role:       models.FacilityAdmin,
				FacilityID: admin.FacilityID,
			}).
			Do().
			ExpectStatus(http.StatusBadRequest).
			ExpectBodyContains("user is not enrolled in class")
	})

	t.Run("Accept delete attendance for enrolled user on valid date", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodDelete,
			fmt.Sprintf("/api/program-classes/%d/events/%d/attendance/%d?date=%s", class.ID, event.ID, enrolledStudent.ID, validDate), nil).
			WithTestClaims(&handlers.Claims{
				Role:       models.FacilityAdmin,
				FacilityID: admin.FacilityID,
			}).
			Do().
			ExpectStatus(http.StatusNoContent)
	})
}
