package integration

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"testing"
	"time"

	"UnlockEdv2/src/handlers"
	"UnlockEdv2/src/models"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

func TestCreateClassHandler(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Test Facility")
	require.NoError(t, err)

	facilityAdmin, err := env.CreateTestUser("testadmin", models.FacilityAdmin, facility.ID, "")
	require.NoError(t, err)

	// - [x] Create class when request is valid
	// - [ ] Create class at facility not offered is invalid
	// - [ ] Bad request when program id is invalid
	// - [ ] Internal service error when program id isn't found
	// - [x] Status conflict when program is inactive or archived

	t.Run("Create class when request is valid", func(t *testing.T) {
		runCreateClassTest(t, env, facility, facilityAdmin)
	})

	t.Run("Create class for inactive program is invalid", func(t *testing.T) {
		runCreateClassInactiveProgramTest(t, env, facility, facilityAdmin)
	})

	t.Run("Create class for archived program is invalid", func(t *testing.T) {
		runCreateClassArchivedProgramTest(t, env, facility, facilityAdmin)
	})

	t.Run("Create class at facility not offered is invalid", func(t *testing.T) {
		runCreateClassNotOfferedFacilityTest(t, env, facility, facilityAdmin)
	})
}

// successful class is created
func runCreateClassTest(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User) {
	program, err := env.CreateTestProgram("Test Program", models.FundingType(models.FederalGrants), []models.ProgramType{}, []models.ProgramCreditType{}, true, nil)
	require.NoError(t, err)

	err = env.SetFacilitiesToProgram(program.ID, []uint{facility.ID})
	require.NoError(t, err)

	class := newClass(program, facility)

	resp := NewRequest[*models.ProgramClass](env.Client, t, http.MethodPost, fmt.Sprintf("/api/programs/%d/classes", program.ID), class).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusCreated)

	got := resp.GetData()

	require.NotZero(t, got.ID)
	require.Equal(t, class.Name, got.Name)
	require.Equal(t, class.InstructorName, got.InstructorName)
	require.Equal(t, class.Description, got.Description)
	require.WithinDuration(t, class.StartDt, got.StartDt, time.Millisecond)
	require.WithinDuration(t, *class.EndDt, *got.EndDt, time.Millisecond)
	require.Equal(t, class.Status, got.Status)
	require.Equal(t, class.CreditHours, got.CreditHours)
}

func runCreateClassInactiveProgramTest(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User) {
	program, err := env.CreateTestProgram("Inactive Program", models.FundingType(models.FederalGrants), []models.ProgramType{}, []models.ProgramCreditType{}, false, nil)
	require.NoError(t, err)

	err = env.SetFacilitiesToProgram(program.ID, []uint{facility.ID})
	require.NoError(t, err)

	class := newClass(program, facility)

	NewRequest[*models.ProgramClass](env.Client, t, http.MethodPost, fmt.Sprintf("/api/programs/%d/classes", program.ID), class).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID}).
		Do().
		ExpectStatus(http.StatusUnauthorized)
}

func runCreateClassArchivedProgramTest(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User) {
	archivedAt := time.Date(2022, 12, 1, 0, 0, 0, 0, time.UTC)
	program, err := env.CreateTestProgram("Archived Program", models.FundingType(models.FederalGrants), []models.ProgramType{}, []models.ProgramCreditType{}, true, &archivedAt)
	require.NoError(t, err)

	err = env.SetFacilitiesToProgram(program.ID, []uint{facility.ID})
	require.NoError(t, err)

	class := newClass(program, facility)

	NewRequest[*models.ProgramClass](env.Client, t, http.MethodPost, fmt.Sprintf("/api/programs/%d/classes", program.ID), class).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusUnauthorized)
}

func runCreateClassNotOfferedFacilityTest(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User) {
	program, err := env.CreateTestProgram("Not Offered at Facility", models.FundingType(models.FederalGrants), []models.ProgramType{}, []models.ProgramCreditType{}, true, nil)
	require.NoError(t, err)
	class := newClass(program, facility)

	NewRequest[*models.ProgramClass](env.Client, t, http.MethodPost, fmt.Sprintf("/api/programs/%d/classes", program.ID), class).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusUnauthorized)
}

// creates a boilerplate class
func newClass(program *models.Program, facility *models.Facility) models.ProgramClass {
	endDt := time.Now().Add(time.Hour * 24)
	creditHours := int64(2)

	class := models.ProgramClass{
		ProgramID:      program.ID,
		FacilityID:     facility.ID,
		Capacity:       10,
		Name:           "Test Class",
		InstructorName: "Test Instructor",
		Description:    "This is a test class created for integration testing purposes.",
		StartDt:        time.Now(),
		EndDt:          &endDt,
		Status:         models.Scheduled,
		CreditHours:    &creditHours,
	}
	return class
}

func TestUpdateClasses(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Test Facility")
	require.NoError(t, err)

	facilityAdmin, err := env.CreateTestUser("testadmin", models.FacilityAdmin, facility.ID, "")
	require.NoError(t, err)

	// Create program and make it available at facility
	program, err := env.CreateTestProgram("Test Program", models.FundingType(models.FederalGrants), []models.ProgramType{}, []models.ProgramCreditType{}, true, nil)
	require.NoError(t, err)

	err = env.SetFacilitiesToProgram(program.ID, []uint{facility.ID})
	require.NoError(t, err)

	t.Run("Update class from Scheduled to Active sets enrolled_at for existing enrollments", func(t *testing.T) {
		runUpdateClassScheduledToActiveTest(t, env, facility, facilityAdmin, program)
	})

	t.Run("Update Active class to Cancelled sets enrollment_ended_at for existing enrollments", func(t *testing.T) {
		runUpdateActiveClassToCancelledTest(t, env, facility, facilityAdmin, program)
	})

	t.Run("Update Paused class to Cancelled sets enrollment_ended_at for existing enrollments", func(t *testing.T) {
		runUpdatePausedClassToCancelledTest(t, env, facility, facilityAdmin, program)
	})

	t.Run("Update Active to Paused to Active preserves original enrolled_at timestamps", func(t *testing.T) {
		runUpdateActivePausedActiveTest(t, env, facility, facilityAdmin, program)
	})
}

func runUpdateClassScheduledToActiveTest(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User, program *models.Program) {

	// Create a scheduled class using helper function
	class, err := env.CreateTestClass(program, facility, models.Scheduled)
	require.NoError(t, err)

	// Create test users
	user1, err := env.CreateTestUser("testuser1", models.Student, facility.ID, "123")
	require.NoError(t, err)
	user2, err := env.CreateTestUser("testuser2", models.Student, facility.ID, "456")
	require.NoError(t, err)

	// Create enrollments using helper function
	enrollment1, err := env.CreateTestEnrollment(class.ID, user1.ID, models.Enrolled)
	require.NoError(t, err)
	enrollment2, err := env.CreateTestEnrollment(class.ID, user2.ID, models.Enrolled)
	require.NoError(t, err)

	// Verify enrollments start with enrolled_at = NULL
	enrolledAt1, endedAt1, err := env.GetEnrollmentTimestamps(enrollment1.ID)
	require.NoError(t, err)
	require.Nil(t, enrolledAt1, "enrolled_at should be NULL for scheduled class")
	require.Nil(t, endedAt1, "enrollment_ended_at should be NULL initially")

	enrolledAt2, endedAt2, err := env.GetEnrollmentTimestamps(enrollment2.ID)
	require.NoError(t, err)
	require.Nil(t, enrolledAt2, "enrolled_at should be NULL for scheduled class")
	require.Nil(t, endedAt2, "enrollment_ended_at should be NULL initially")

	// Update class status to Active via API using the bulk update endpoint
	updateData := map[string]interface{}{
		"status": string(models.Active),
	}

	NewRequest[interface{}](env.Client, t, http.MethodPatch, fmt.Sprintf("/api/program-classes?id=%d", class.ID), updateData).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	// Verify enrolled_at timestamps were set
	enrolledAt1After, endedAt1After, err := env.GetEnrollmentTimestamps(enrollment1.ID)
	require.NoError(t, err)
	require.NotNil(t, enrolledAt1After, "enrolled_at should be set when class becomes Active")
	require.WithinDuration(t, time.Now(), *enrolledAt1After, time.Second*5, "enrolled_at should be recent")
	require.Nil(t, endedAt1After, "enrollment_ended_at should still be NULL")

	enrolledAt2After, endedAt2After, err := env.GetEnrollmentTimestamps(enrollment2.ID)
	require.NoError(t, err)
	require.NotNil(t, enrolledAt2After, "enrolled_at should be set when class becomes Active")
	require.WithinDuration(t, time.Now(), *enrolledAt2After, time.Second*5, "enrolled_at should be recent")
	require.Nil(t, endedAt2After, "enrollment_ended_at should still be NULL")
}

func runUpdateActiveClassToCancelledTest(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User, program *models.Program) {
	// Create an Active class
	class, err := env.CreateTestClass(program, facility, models.Active)
	require.NoError(t, err)

	// Create test users
	user1, err := env.CreateTestUser("activeuser1", models.Student, facility.ID, "789")
	require.NoError(t, err)
	user2, err := env.CreateTestUser("activeuser2", models.Student, facility.ID, "790")
	require.NoError(t, err)

	// Create enrollments in Active class (should set enrolled_at immediately)
	enrollment1, err := env.CreateTestEnrollment(class.ID, user1.ID, models.Enrolled)
	require.NoError(t, err)
	enrollment2, err := env.CreateTestEnrollment(class.ID, user2.ID, models.Enrolled)
	require.NoError(t, err)

	// Verify initial state: enrolled_at set, enrollment_ended_at NULL
	enrolledAt1, endedAt1, err := env.GetEnrollmentTimestamps(enrollment1.ID)
	require.NoError(t, err)
	require.NotNil(t, enrolledAt1, "enrolled_at should be set for Active class")
	require.Nil(t, endedAt1, "enrollment_ended_at should be NULL initially")

	enrolledAt2, endedAt2, err := env.GetEnrollmentTimestamps(enrollment2.ID)
	require.NoError(t, err)
	require.NotNil(t, enrolledAt2, "enrolled_at should be set for Active class")
	require.Nil(t, endedAt2, "enrollment_ended_at should be NULL initially")

	// Update class status to Cancelled via API
	updateData := map[string]interface{}{
		"status": string(models.Cancelled),
	}

	NewRequest[interface{}](env.Client, t, http.MethodPatch, fmt.Sprintf("/api/program-classes?id=%d", class.ID), updateData).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	// Verify enrollment statuses were updated and enrollment_ended_at was set
	var updatedEnrollments []models.ProgramClassEnrollment
	err = env.DB.Where("class_id = ?", class.ID).Find(&updatedEnrollments).Error
	require.NoError(t, err)
	require.Len(t, updatedEnrollments, 2)

	for _, enrollment := range updatedEnrollments {
		require.Equal(t, models.EnrollmentCancelled, enrollment.EnrollmentStatus, "enrollment should be cancelled when class is cancelled")
		require.NotNil(t, enrollment.EnrolledAt, "enrolled_at should remain set")
		require.NotNil(t, enrollment.EnrollmentEndedAt, "enrollment_ended_at should be set when class is cancelled")
		require.WithinDuration(t, time.Now(), *enrollment.EnrollmentEndedAt, time.Second*5, "enrollment_ended_at should be recent")
	}
}

func runUpdatePausedClassToCancelledTest(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User, program *models.Program) {
	// Create an Active class first
	class, err := env.CreateTestClass(program, facility, models.Active)
	require.NoError(t, err)

	// Create test users
	user1, err := env.CreateTestUser("pauseduser1", models.Student, facility.ID, "791")
	require.NoError(t, err)
	user2, err := env.CreateTestUser("pauseduser2", models.Student, facility.ID, "792")
	require.NoError(t, err)

	// Create enrollments in Active class (should set enrolled_at immediately)
	enrollment1, err := env.CreateTestEnrollment(class.ID, user1.ID, models.Enrolled)
	require.NoError(t, err)
	enrollment2, err := env.CreateTestEnrollment(class.ID, user2.ID, models.Enrolled)
	require.NoError(t, err)

	// Verify initial state: enrolled_at set, enrollment_ended_at NULL
	enrolledAt1, endedAt1, err := env.GetEnrollmentTimestamps(enrollment1.ID)
	require.NoError(t, err)
	require.NotNil(t, enrolledAt1, "enrolled_at should be set for Active class")
	require.Nil(t, endedAt1, "enrollment_ended_at should be NULL initially")

	enrolledAt2, endedAt2, err := env.GetEnrollmentTimestamps(enrollment2.ID)
	require.NoError(t, err)
	require.NotNil(t, enrolledAt2, "enrolled_at should be set for Active class")
	require.Nil(t, endedAt2, "enrollment_ended_at should be NULL initially")

	// Update class status from Active to Paused via API
	updateData := map[string]interface{}{
		"status": string(models.Paused),
	}

	NewRequest[interface{}](env.Client, t, http.MethodPatch, fmt.Sprintf("/api/program-classes?id=%d", class.ID), updateData).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	// Update class status from Paused to Cancelled via API
	updateData = map[string]interface{}{
		"status": string(models.Cancelled),
	}

	NewRequest[interface{}](env.Client, t, http.MethodPatch, fmt.Sprintf("/api/program-classes?id=%d", class.ID), updateData).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	// Verify enrollment statuses were updated and enrollment_ended_at was set
	var updatedEnrollments []models.ProgramClassEnrollment
	err = env.DB.Where("class_id = ?", class.ID).Find(&updatedEnrollments).Error
	require.NoError(t, err)
	require.Len(t, updatedEnrollments, 2)

	for _, enrollment := range updatedEnrollments {
		require.Equal(t, models.EnrollmentCancelled, enrollment.EnrollmentStatus, "enrollment should be cancelled when class is cancelled")
		require.NotNil(t, enrollment.EnrolledAt, "enrolled_at should remain set since class was previously Active")
		require.NotNil(t, enrollment.EnrollmentEndedAt, "enrollment_ended_at should be set when class is cancelled")
		require.WithinDuration(t, time.Now(), *enrollment.EnrollmentEndedAt, time.Second*5, "enrollment_ended_at should be recent")
	}
}

func runUpdateActivePausedActiveTest(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User, program *models.Program) {
	// Create an Active class
	class, err := env.CreateTestClass(program, facility, models.Active)
	require.NoError(t, err)

	// Create test user and enrollment
	user, err := env.CreateTestUser("activepauseduser", models.Student, facility.ID, "793")
	require.NoError(t, err)

	enrollment, err := env.CreateTestEnrollment(class.ID, user.ID, models.Enrolled)
	require.NoError(t, err)

	// Capture original enrolled_at timestamp
	originalEnrolledAt, endedAt, err := env.GetEnrollmentTimestamps(enrollment.ID)
	require.NoError(t, err)
	require.NotNil(t, originalEnrolledAt, "enrolled_at should be set for Active class")
	require.Nil(t, endedAt, "enrollment_ended_at should be NULL initially")

	// Wait to ensure any new timestamps would be different
	time.Sleep(time.Millisecond * 50)

	// Update class status from Active to Paused
	updateData := map[string]interface{}{
		"status": string(models.Paused),
	}

	NewRequest[interface{}](env.Client, t, http.MethodPatch, fmt.Sprintf("/api/program-classes?id=%d", class.ID), updateData).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	// Verify enrolled_at timestamp remains unchanged after pausing
	enrolledAtAfterPause, endedAtAfterPause, err := env.GetEnrollmentTimestamps(enrollment.ID)
	require.NoError(t, err)
	require.Equal(t, originalEnrolledAt, enrolledAtAfterPause, "enrolled_at should not change when pausing")
	require.Nil(t, endedAtAfterPause, "enrollment_ended_at should still be NULL after pausing")

	// Update class status from Paused back to Active
	updateData = map[string]interface{}{
		"status": string(models.Active),
	}

	NewRequest[interface{}](env.Client, t, http.MethodPatch, fmt.Sprintf("/api/program-classes?id=%d", class.ID), updateData).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	// Verify enrolled_at timestamp STILL remains unchanged (not updated to new timestamp)
	enrolledAtFinal, endedAtFinal, err := env.GetEnrollmentTimestamps(enrollment.ID)
	require.NoError(t, err)
	require.Equal(t, originalEnrolledAt, enrolledAtFinal, "enrolled_at should preserve original timestamp when going Paused->Active")
	require.Nil(t, endedAtFinal, "enrollment_ended_at should still be NULL after reactivating")
}

func TestMain(m *testing.M) {
	logrus.SetOutput(io.Discard)
	code := m.Run()
	os.Exit(code)
}
