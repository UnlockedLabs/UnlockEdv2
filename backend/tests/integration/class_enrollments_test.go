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

	t.Run("Enroll users in Active class sets enrolled_at immediately", func(t *testing.T) {
		runEnrollInActiveClassTest(t, env, facility, facilityAdmin)
	})

	t.Run("Enroll users in Scheduled class leaves enrolled_at NULL", func(t *testing.T) {
		runEnrollInScheduledClassTest(t, env, facility, facilityAdmin)
	})
}

func runEnrollInActiveClassTest(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User) {
	// Create program and make it available at facility
	program, err := env.CreateTestProgram("Active Class Test Program", models.FundingType(models.FederalGrants), []models.ProgramType{}, []models.ProgramCreditType{}, true, nil)
	require.NoError(t, err)

	err = env.SetFacilitiesToProgram(program.ID, []uint{facility.ID})
	require.NoError(t, err)

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

func runEnrollInScheduledClassTest(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User) {
	// Create program and make it available at facility
	program, err := env.CreateTestProgram("Scheduled Class Test Program", models.FundingType(models.FederalGrants), []models.ProgramType{}, []models.ProgramCreditType{}, true, nil)
	require.NoError(t, err)

	err = env.SetFacilitiesToProgram(program.ID, []uint{facility.ID})
	require.NoError(t, err)

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

