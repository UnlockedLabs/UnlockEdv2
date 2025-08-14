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

	t.Run("Update enrollment to Cancelled status on Active class return 400 status code", func(t *testing.T) {
		runUpdateToCancelledStatusTest(t, env, facility, facilityAdmin)
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

func runUpdateToCancelledStatusTest(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User) {
	// Create program and make it available at facility
	program, err := env.CreateTestProgram("Cancelled Status Test Program", models.FundingType(models.FederalGrants), []models.ProgramType{}, []models.ProgramCreditType{}, true, nil)
	require.NoError(t, err)

	err = env.SetFacilitiesToProgram(program.ID, []uint{facility.ID})
	require.NoError(t, err)

	// Create an Active class
	activeClass, err := env.CreateTestClass(program, facility, models.Active)
	require.NoError(t, err)

	cancelledStatus := models.EnrollmentCancelled
	user, err := env.CreateTestUser("statususer1", models.Student, facility.ID, "status1001")
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
		"enrollment_status": string(cancelledStatus),
		"user_ids":          []int{int(user.ID)},
	}

	NewRequest[interface{}](env.Client, t, http.MethodPatch, fmt.Sprintf("/api/program-classes/%d/enrollments", activeClass.ID), updateData).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusBadRequest)
}
func TestGetHistoricalEnrollmentBatch(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Test Facility")
	require.NoError(t, err)

	facilityAdmin, err := env.CreateTestUser("testadmin", models.FacilityAdmin, facility.ID, "")
	require.NoError(t, err)

	// Create program and make it available at facility
	program, err := env.CreateTestProgram("Historical Enrollment Test Program", models.FundingType(models.FederalGrants), []models.ProgramType{}, []models.ProgramCreditType{}, true, nil)
	require.NoError(t, err)

	err = env.SetFacilitiesToProgram(program.ID, []uint{facility.ID})
	require.NoError(t, err)

	// Create an Active class
	activeClass, err := env.CreateTestClass(program, facility, models.Active)
	require.NoError(t, err)

	// Create test users
	user1, err := env.CreateTestUser("histuser1", models.Student, facility.ID, "hist1")
	require.NoError(t, err)
	user2, err := env.CreateTestUser("histuser2", models.Student, facility.ID, "hist2")
	require.NoError(t, err)
	user3, err := env.CreateTestUser("histuser3", models.Student, facility.ID, "hist3")
	require.NoError(t, err)

	// Create enrollments with specific dates
	// User1: enrolled on 2025-08-13
	enrolledAt1 := time.Date(2025, 8, 13, 0, 0, 0, 0, time.UTC)
	enrollment1 := &models.ProgramClassEnrollment{
		ClassID:          activeClass.ID,
		UserID:           user1.ID,
		EnrollmentStatus: models.Enrolled,
		EnrolledAt:       &enrolledAt1,
	}
	err = env.DB.Create(enrollment1).Error
	require.NoError(t, err)

	// User2: enrolled on 2025-08-14
	enrolledAt2 := time.Date(2025, 8, 14, 0, 0, 0, 0, time.UTC)
	enrollment2 := &models.ProgramClassEnrollment{
		ClassID:          activeClass.ID,
		UserID:           user2.ID,
		EnrollmentStatus: models.Enrolled,
		EnrolledAt:       &enrolledAt2,
	}
	err = env.DB.Create(enrollment2).Error
	require.NoError(t, err)

	// User3: enrolled on 2025-08-15, ended on 2025-08-16
	enrolledAt3 := time.Date(2025, 8, 15, 0, 0, 0, 0, time.UTC)
	endedAt3 := time.Date(2025, 8, 16, 0, 0, 0, 0, time.UTC)
	enrollment3 := &models.ProgramClassEnrollment{
		ClassID:           activeClass.ID,
		UserID:            user3.ID,
		EnrollmentStatus:  models.EnrollmentCompleted,
		EnrolledAt:        &enrolledAt3,
		EnrollmentEndedAt: &endedAt3,
	}
	err = env.DB.Create(enrollment3).Error
	require.NoError(t, err)

	t.Run("Single date with varying enrollment levels", func(t *testing.T) {
		runSingleDateHistoricalEnrollmentTest(t, env, activeClass, facilityAdmin, facility, user1, user2, user3)
	})

	t.Run("Batch multiple dates with varying enrollment levels", func(t *testing.T) {
		runBatchDateHistoricalEnrollmentTest(t, env, activeClass, facilityAdmin, facility, user1, user2, user3)
	})

	t.Run("Edge cases and validation", func(t *testing.T) {
		runHistoricalEnrollmentEdgeCasesTest(t, env, activeClass, facilityAdmin, facility)
	})
}

func runSingleDateHistoricalEnrollmentTest(t *testing.T, env *TestEnv, activeClass *models.ProgramClass, facilityAdmin *models.User, facility *models.Facility, user1, user2, user3 *models.User) {
	// Test single date queries
	testCases := []struct {
		date     string
		expected int64
		desc     string
	}{
		{"2025-08-12", 0, "no enrollments before 2025-08-13"},
		{"2025-08-13", 1, "only user1 enrolled by 2025-08-13"},
		{"2025-08-14", 2, "user1 and user2 enrolled by 2025-08-14"},
		{"2025-08-15", 3, "all three users enrolled on 2025-08-15"},
		{"2025-08-16", 2, "user3 enrollment ended on 2025-08-16, so only user1 and user2"},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			resp := NewRequest[map[string]int64](env.Client, t, http.MethodGet, fmt.Sprintf("/api/program-classes/%d/historical-enrollment-batch?dates=%s", activeClass.ID, tc.date), nil).
				WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
				Do().
				ExpectStatus(http.StatusOK)

			result := resp.GetData()
			require.Contains(t, result, tc.date, "Response should contain the requested date")
			require.Equal(t, tc.expected, result[tc.date], tc.desc)
		})
	}
}

func runBatchDateHistoricalEnrollmentTest(t *testing.T, env *TestEnv, activeClass *models.ProgramClass, facilityAdmin *models.User, facility *models.Facility, user1, user2, user3 *models.User) {
	// Test batch query with multiple dates
	dates := "2025-08-12,2025-08-13,2025-08-14,2025-08-15,2025-08-16"
	resp := NewRequest[map[string]int64](env.Client, t, http.MethodGet, fmt.Sprintf("/api/program-classes/%d/historical-enrollment-batch?dates=%s", activeClass.ID, dates), nil).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	result := resp.GetData()

	// Verify all dates are present in response
	expectedResults := map[string]int64{
		"2025-08-12": 0, // no enrollments before 2025-08-13
		"2025-08-13": 1, // only user1 enrolled by 2025-08-13
		"2025-08-14": 2, // user1 and user2 enrolled by 2025-08-14
		"2025-08-15": 3, // all three users enrolled on 2025-08-15
		"2025-08-16": 2, // user3 enrollment ended on 2025-08-16, so only user1 and user2
	}

	require.Len(t, result, 5, "Should return results for all 5 dates")

	for date, expected := range expectedResults {
		require.Contains(t, result, date, "Response should contain date %s", date)
		require.Equal(t, expected, result[date], "Incorrect enrollment count for %s", date)
	}

	// Verify this was a single API call that returned all results
	t.Logf("Successfully retrieved historical enrollment data for %d dates in a single batch request", len(expectedResults))
}

func runHistoricalEnrollmentEdgeCasesTest(t *testing.T, env *TestEnv, activeClass *models.ProgramClass, facilityAdmin *models.User, facility *models.Facility) {
	// Test case 1: Missing dates parameter
	t.Run("Missing dates parameter", func(t *testing.T) {
		NewRequest[interface{}](env.Client, t, http.MethodGet, fmt.Sprintf("/api/program-classes/%d/historical-enrollment-batch", activeClass.ID), nil).
			WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
			Do().
			ExpectStatus(http.StatusBadRequest)
	})

	// Test case 2: Empty dates parameter
	t.Run("Empty dates parameter", func(t *testing.T) {
		NewRequest[interface{}](env.Client, t, http.MethodGet, fmt.Sprintf("/api/program-classes/%d/historical-enrollment-batch?dates=", activeClass.ID), nil).
			WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
			Do().
			ExpectStatus(http.StatusBadRequest)
	})

	// Test case 3: Invalid date format
	t.Run("Invalid date format", func(t *testing.T) {
		invalidDates := []string{
			"2025/08/13",   // wrong format
			"2025-13-01",   // invalid month
			"2025-02-30",   // invalid day
			"invalid-date", // completely invalid
			"2025-8-1",     // missing zero padding
		}

		for _, invalidDate := range invalidDates {
			t.Run(fmt.Sprintf("date_%s", invalidDate), func(t *testing.T) {
				NewRequest[interface{}](env.Client, t, http.MethodGet, fmt.Sprintf("/api/program-classes/%d/historical-enrollment-batch?dates=%s", activeClass.ID, invalidDate), nil).
					WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
					Do().
					ExpectStatus(http.StatusBadRequest)
			})
		}
	})

	// Test case 4: Mixed valid and invalid dates
	t.Run("Mixed valid and invalid dates", func(t *testing.T) {
		dates := "2025-08-13,invalid-date,2025-08-14"
		NewRequest[interface{}](env.Client, t, http.MethodGet, fmt.Sprintf("/api/program-classes/%d/historical-enrollment-batch?dates=%s", activeClass.ID, dates), nil).
			WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
			Do().
			ExpectStatus(http.StatusBadRequest)
	})
}
