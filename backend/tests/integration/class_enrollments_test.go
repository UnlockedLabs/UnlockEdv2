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

func TestEnrollUsersInClass(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Test Facility")
	require.NoError(t, err)

	facilityAdmin, err := env.CreateTestUser("testadmin", models.FacilityAdmin, facility.ID, "")
	require.NoError(t, err)

	// Create program and make it available at facility
	program, err := env.CreateTestProgram("Active Class Test Program", models.FundingType(models.FederalGrants), []models.ProgramType{}, []models.ProgramCreditType{}, true, nil)
	require.NoError(t, err)

	err = env.SetFacilitiesToProgram(program.ID, []uint{facility.ID})
	require.NoError(t, err)

	t.Run("Enroll users in Active class sets enrolled_at immediately", func(t *testing.T) {
		runEnrollInActiveClassTest(t, env, facility, facilityAdmin, program)
	})

	t.Run("Enroll users in Scheduled class leaves enrolled_at NULL", func(t *testing.T) {
		runEnrollInScheduledClassTest(t, env, facility, facilityAdmin, program)
	})
}

func runEnrollInActiveClassTest(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User, program *models.Program) {
	// Create an Active class
	activeClass, err := env.CreateTestClass(program, facility, models.Active)
	require.NoError(t, err)

	// Create test users
	user1, err := env.CreateTestUser("activeuser1", models.Student, facility.ID, "111")
	require.NoError(t, err)
	user2, err := env.CreateTestUser("activeuser2", models.Student, facility.ID, "222")
	require.NoError(t, err)

	// Enroll users via API endpoint
	enrollmentData := map[string]interface{}{
		"user_ids": []int{int(user1.ID), int(user2.ID)},
	}

	NewRequest[interface{}](env.Client, t, http.MethodPost, fmt.Sprintf("/api/program-classes/%d/enrollments", activeClass.ID), enrollmentData).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusCreated)

	// Verify enrolled_at timestamps were set immediately for Active class
	var enrollments []models.ProgramClassEnrollment
	err = env.DB.Where("class_id = ?", activeClass.ID).Find(&enrollments).Error
	require.NoError(t, err)
	require.Len(t, enrollments, 2, "Should have 2 enrollments")

	for _, enrollment := range enrollments {
		require.NotNil(t, enrollment.EnrolledAt, "enrolled_at should be set immediately for Active class")
		require.WithinDuration(t, time.Now(), *enrollment.EnrolledAt, time.Second*5, "enrolled_at should be recent")
		require.Nil(t, enrollment.EnrollmentEndedAt, "enrollment_ended_at should be NULL initially")
		require.Equal(t, models.Enrolled, enrollment.EnrollmentStatus, "status should be Enrolled")
	}
}

func runEnrollInScheduledClassTest(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User, program *models.Program) {
	// Create a Scheduled class
	scheduledClass, err := env.CreateTestClass(program, facility, models.Scheduled)
	require.NoError(t, err)

	// Create test users
	user1, err := env.CreateTestUser("scheduleduser1", models.Student, facility.ID, "333")
	require.NoError(t, err)
	user2, err := env.CreateTestUser("scheduleduser2", models.Student, facility.ID, "444")
	require.NoError(t, err)

	// Enroll users via API endpoint
	enrollmentData := map[string]interface{}{
		"user_ids": []int{int(user1.ID), int(user2.ID)},
	}

	NewRequest[interface{}](env.Client, t, http.MethodPost, fmt.Sprintf("/api/program-classes/%d/enrollments", scheduledClass.ID), enrollmentData).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusCreated)

	// Verify enrolled_at timestamps are NULL for Scheduled class
	var enrollments []models.ProgramClassEnrollment
	err = env.DB.Where("class_id = ?", scheduledClass.ID).Find(&enrollments).Error
	require.NoError(t, err)
	require.Len(t, enrollments, 2, "Should have 2 enrollments")

	for _, enrollment := range enrollments {
		require.Nil(t, enrollment.EnrolledAt, "enrolled_at should be NULL for Scheduled class")
		require.Nil(t, enrollment.EnrollmentEndedAt, "enrollment_ended_at should be NULL initially")
		require.Equal(t, models.Enrolled, enrollment.EnrollmentStatus, "status should be Enrolled")
	}
}

func TestUpdateProgramClassEnrollments(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Test Facility")
	require.NoError(t, err)

	facilityAdmin, err := env.CreateTestUser("testadmin", models.FacilityAdmin, facility.ID, "")
	require.NoError(t, err)

	t.Run("Update enrollment to terminal status on Active class sets enrollment_ended_at", func(t *testing.T) {
		runUpdateToTerminalStatusTest(t, env, facility, facilityAdmin)
	})
}

func runUpdateToTerminalStatusTest(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User) {
	// Create program and make it available at facility
	program, err := env.CreateTestProgram("Terminal Status Test Program", models.FundingType(models.FederalGrants), []models.ProgramType{}, []models.ProgramCreditType{}, true, nil)
	require.NoError(t, err)

	err = env.SetFacilitiesToProgram(program.ID, []uint{facility.ID})
	require.NoError(t, err)

	// Create an Active class
	activeClass, err := env.CreateTestClass(program, facility, models.Active)
	require.NoError(t, err)

	// Define all terminal statuses
	terminalStatuses := []models.ProgramEnrollmentStatus{
		models.EnrollmentCancelled,
		models.EnrollmentCompleted,
		models.EnrollmentIncompleteWithdrawn,
		models.EnrollmentIncompleteDropped,
		models.EnrollmentIncompleteFailedToComplete,
		models.EnrollmentIncompleteTransfered,
		models.EnrollmentIncompleteSegregated,
	}

	// Test each terminal status
	for i, status := range terminalStatuses {
		t.Run(string(status), func(t *testing.T) {
			// Create a unique test user for this status
			user, err := env.CreateTestUser(fmt.Sprintf("terminaluser%d", i), models.Student, facility.ID, fmt.Sprintf("test%d", 100+i))
			require.NoError(t, err)

			// Create enrollment in Active class (should set enrolled_at immediately)
			enrollment, err := env.CreateTestEnrollment(activeClass.ID, user.ID, models.Enrolled)
			require.NoError(t, err)

			// Verify initial state: enrolled_at set, enrollment_ended_at NULL
			enrolledAt, endedAt, err := env.GetEnrollmentTimestamps(enrollment.ID)
			require.NoError(t, err)
			require.NotNil(t, enrolledAt, "enrolled_at should be set for Active class enrollment")
			require.Nil(t, endedAt, "enrollment_ended_at should be NULL initially")

			// Update enrollment status to terminal state via API
			updateData := map[string]interface{}{
				"enrollment_status": string(status),
				"user_ids":          []int{int(user.ID)},
			}

			NewRequest[interface{}](env.Client, t, http.MethodPatch, fmt.Sprintf("/api/program-classes/%d/enrollments", activeClass.ID), updateData).
				WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
				Do().
				ExpectStatus(http.StatusOK)

			// Verify enrollment_ended_at timestamp was set
			var updatedEnrollment models.ProgramClassEnrollment
			err = env.DB.Where("class_id = ? AND user_id = ?", activeClass.ID, user.ID).First(&updatedEnrollment).Error
			require.NoError(t, err)

			require.Equal(t, status, updatedEnrollment.EnrollmentStatus, "status should be updated")
			require.NotNil(t, updatedEnrollment.EnrolledAt, "enrolled_at should remain set")
			require.NotNil(t, updatedEnrollment.EnrollmentEndedAt, "enrollment_ended_at should be set for terminal status")
			require.WithinDuration(t, time.Now(), *updatedEnrollment.EnrollmentEndedAt, time.Second*5, "enrollment_ended_at should be recent")
		})
	}
}
