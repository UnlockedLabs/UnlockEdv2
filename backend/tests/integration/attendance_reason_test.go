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

func TestAttendanceReasons(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Test Facility")
	require.NoError(t, err)

	facilityAdmin, err := env.CreateTestUser("testadmin", models.FacilityAdmin, facility.ID, "")
	require.NoError(t, err)

	student, err := env.CreateTestUser("student", models.Student, facility.ID, "STU001")
	require.NoError(t, err)

	program, err := env.CreateTestProgram("Test Program", models.FundingType(models.FederalGrants), []models.ProgramType{}, []models.ProgramCreditType{}, true, nil)
	require.NoError(t, err)

	err = env.SetFacilitiesToProgram(program.ID, []uint{facility.ID})
	require.NoError(t, err)

	instructor, err := env.CreateTestInstructor(facility.ID, "reason")
	require.NoError(t, err)

	class, err := env.CreateTestClass(program, facility, models.Active, &instructor.ID)
	require.NoError(t, err)

	event, err := env.CreateTestEvent(class.ID, "")
	require.NoError(t, err)

	_, err = env.CreateTestEnrollment(class.ID, student.ID, models.Enrolled)
	require.NoError(t, err)

	date := time.Now().Format("2006-01-02")

	t.Run("Save attendance with Medical reason", func(t *testing.T) {
		attendanceData := []models.ProgramClassEventAttendance{
			{
				UserID:           student.ID,
				Date:             date,
				AttendanceStatus: models.Absent_Excused,
				ReasonCategory:   "Medical",
				Note:             "",
			},
		}

		NewRequest[any](env.Client, t, http.MethodPost,
			fmt.Sprintf("/api/program-classes/%d/events/%d/attendance", class.ID, event.ID),
			attendanceData).
			WithTestClaims(&handlers.Claims{
				Role:       models.FacilityAdmin,
				FacilityID: facilityAdmin.FacilityID,
			}).
			Do().
			ExpectStatus(http.StatusOK)

		// Verify in DB
		var stored models.ProgramClassEventAttendance
		err := env.DB.Where("user_id = ? AND event_id = ? AND date = ?", student.ID, event.ID, date).First(&stored).Error
		require.NoError(t, err)
		require.Equal(t, "Medical", stored.ReasonCategory)
		require.Equal(t, "", stored.Note)
	})

	t.Run("Save attendance with Other reason and Note", func(t *testing.T) {
		attendanceData := []models.ProgramClassEventAttendance{
			{
				UserID:           student.ID,
				Date:             date,
				AttendanceStatus: models.Absent_Unexcused,
				ReasonCategory:   "Other",
				Note:             "Something specific",
			},
		}

		NewRequest[any](env.Client, t, http.MethodPost,
			fmt.Sprintf("/api/program-classes/%d/events/%d/attendance", class.ID, event.ID),
			attendanceData).
			WithTestClaims(&handlers.Claims{
				Role:       models.FacilityAdmin,
				FacilityID: facilityAdmin.FacilityID,
			}).
			Do().
			ExpectStatus(http.StatusOK)

		// Verify in DB
		var stored models.ProgramClassEventAttendance
		err := env.DB.Where("user_id = ? AND event_id = ? AND date = ?", student.ID, event.ID, date).First(&stored).Error
		require.NoError(t, err)
		require.Equal(t, "Other", stored.ReasonCategory)
		require.Equal(t, "Something specific", stored.Note)
	})

	t.Run("Update to Present clears reason and note", func(t *testing.T) {
		// First set it to something else (should be covered by previous test, but good to be explicit if run in isolation)
		// But here we just update the existing record from previous step
		attendanceData := []models.ProgramClassEventAttendance{
			{
				UserID:           student.ID,
				Date:             date,
				AttendanceStatus: models.Present,
				ReasonCategory:   "", // Frontend sends empty string
				Note:             "",
			},
		}

		NewRequest[any](env.Client, t, http.MethodPost,
			fmt.Sprintf("/api/program-classes/%d/events/%d/attendance", class.ID, event.ID),
			attendanceData).
			WithTestClaims(&handlers.Claims{
				Role:       models.FacilityAdmin,
				FacilityID: facilityAdmin.FacilityID,
			}).
			Do().
			ExpectStatus(http.StatusOK)

		// Verify in DB
		var stored models.ProgramClassEventAttendance
		err := env.DB.Where("user_id = ? AND event_id = ? AND date = ?", student.ID, event.ID, date).First(&stored).Error
		require.NoError(t, err)
		require.Equal(t, models.Present, stored.AttendanceStatus)
		// Note: Depending on how the update works, it might not clear fields if they are not specified,
		// but the handler receives the whole struct.
		// The `LogUserAttendance` uses `clause.OnConflict` with `DoUpdates`.
		// If we send empty strings, they should be updated to empty strings.
		require.Equal(t, "", stored.ReasonCategory)
		require.Equal(t, "", stored.Note)
	})

	t.Run("Update from Present back to Absent saves reason", func(t *testing.T) {
		attendanceData := []models.ProgramClassEventAttendance{
			{
				UserID:           student.ID,
				Date:             date,
				AttendanceStatus: models.Absent_Excused,
				ReasonCategory:   "Disciplinary",
				Note:             "",
			},
		}

		NewRequest[any](env.Client, t, http.MethodPost,
			fmt.Sprintf("/api/program-classes/%d/events/%d/attendance", class.ID, event.ID),
			attendanceData).
			WithTestClaims(&handlers.Claims{
				Role:       models.FacilityAdmin,
				FacilityID: facilityAdmin.FacilityID,
			}).
			Do().
			ExpectStatus(http.StatusOK)

		// Verify in DB
		var stored models.ProgramClassEventAttendance
		err := env.DB.Where("user_id = ? AND event_id = ? AND date = ?", student.ID, event.ID, date).First(&stored).Error
		require.NoError(t, err)
		require.Equal(t, models.Absent_Excused, stored.AttendanceStatus)
		require.Equal(t, "Disciplinary", stored.ReasonCategory)
	})
}
