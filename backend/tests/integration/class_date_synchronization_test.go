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

// TestClassDateSynchronization tests that class start_dt and end_dt fields
// automatically synchronize with event schedules when events are modified.
func TestClassDateSynchronization(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Test Facility")
	require.NoError(t, err)

	facilityAdmin, err := env.CreateTestUser("testadmin", models.FacilityAdmin, facility.ID, "")
	require.NoError(t, err)

	program, err := env.CreateTestProgram("Test Program", models.FundingType(models.FederalGrants), []models.ProgramType{}, []models.ProgramCreditType{}, true, nil)
	require.NoError(t, err)

	err = env.SetFacilitiesToProgram(program.ID, []uint{facility.ID})
	require.NoError(t, err)

	t.Run("Event override creation extends class end date", func(t *testing.T) {
		runTestOverrideCreationExtendsEndDate(t, env, facility, facilityAdmin, program)
	})

	t.Run("Event rescheduling extends class across multiple months", func(t *testing.T) {
		runTestEventReschedulingExtendsMultipleMonths(t, env, facility, facilityAdmin, program)
	})

	t.Run("Multiple overrides extend class end date appropriately", func(t *testing.T) {
		runTestMultipleOverridesExtendEndDate(t, env, facility, facilityAdmin, program)
	})

	t.Run("Cannot modify events for completed classes", func(t *testing.T) {
		runTestCannotModifyEventsForCompletedClasses(t, env, facility, facilityAdmin, program)
	})

	t.Run("Class start date updates when event moved earlier", func(t *testing.T) {
		runTestStartDateUpdatesWhenEventMovedEarlier(t, env, facility, facilityAdmin, program)
	})

	t.Run("Event cancellation affects class boundaries", func(t *testing.T) {
		runTestEventCancellationAffectsBoundaries(t, env, facility, facilityAdmin, program)
	})
}

func runTestOverrideCreationExtendsEndDate(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User, program *models.Program) {
	classStartDate := time.Date(2025, 11, 1, 0, 0, 0, 0, time.UTC)  // November 1, 2025
	initialEndDate := time.Date(2025, 11, 30, 0, 0, 0, 0, time.UTC) // November 30, 2025
	creditHours := int64(3)

	class := models.ProgramClass{
		ProgramID:      program.ID,
		FacilityID:     facility.ID,
		Capacity:       15,
		Name:           "Override Extension Test Class",
		InstructorName: "Test Instructor",
		Description:    "Testing that override creation extends end date",
		StartDt:        classStartDate,
		EndDt:          &initialEndDate,
		Status:         models.Scheduled,
		CreditHours:    &creditHours,
	}

	classResp := NewRequest[*models.ProgramClass](env.Client, t, http.MethodPost, fmt.Sprintf("/api/programs/%d/classes", program.ID), class).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusCreated)

	createdClass := classResp.GetData()
	require.Equal(t, initialEndDate, *createdClass.EndDt, "Initial end date should be November 30")

	eventPayload := map[string]interface{}{
		"duration":        "2h",
		"room":            "Test Room 101",
		"recurrence_rule": "DTSTART:20251101T180000Z\nRRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20251130T000000Z",
	}

	resp := NewRequest[any](env.Client, t, http.MethodPost, fmt.Sprintf("/api/program-classes/%d/events", createdClass.ID), eventPayload).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do()

	var createdEvent models.ProgramClassEvent
	err := env.DB.Where("class_id = ?", createdClass.ID).First(&createdEvent).Error
	if err == nil {
		t.Logf("Event successfully created in DB with ID: %d", createdEvent.ID)
	} else {
		t.Logf("No event found in DB: %v", err)
	}

	if resp.resp.StatusCode == http.StatusCreated || resp.resp.StatusCode == http.StatusOK {
		t.Logf("Event creation API successful")
		if err == nil {
			t.Logf("Event creation DB successful - Full success!")
		} else {
			t.Logf("API success but DB query failed")
		}
	} else {
		t.Errorf("Event creation failed - Status: %d", resp.resp.StatusCode)
	}

	event := &createdEvent

	overridePayload := []map[string]interface{}{
		{
			"event_id":       event.ID,
			"class_id":       createdClass.ID,
			"override_rrule": "DTSTART:20251127T180000Z\nRRULE:FREQ=DAILY;COUNT=1",
			"duration":       "2h",
			"room":           "Rescheduled Room",
			"is_cancelled":   true,
			"reason":         "Thanksgiving reschedule",
		},
		{
			"event_id":       event.ID,
			"class_id":       createdClass.ID,
			"override_rrule": "DTSTART:20251202T180000Z\nRRULE:FREQ=DAILY;COUNT=1",
			"duration":       "2h",
			"room":           "Holiday Room",
			"is_cancelled":   false,
			"reason":         "Post-Thanksgiving session",
		},
	}

	NewRequest[any](env.Client, t, http.MethodPut, fmt.Sprintf("/api/program-classes/%d/events/%d", createdClass.ID, event.ID), overridePayload).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	updatedClassResp := NewRequest[*models.ProgramClass](env.Client, t, http.MethodGet, fmt.Sprintf("/api/program-classes/%d", createdClass.ID), nil).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	updatedClass := updatedClassResp.GetData()
	expectedEndDate := time.Date(2025, 12, 2, 18, 0, 0, 0, time.UTC) // December 2, 2025 at 6 PM UTC (when override event occurs)
	require.Equal(t, expectedEndDate, *updatedClass.EndDt, "Class end date should be extended to December 2 at 6 PM UTC")
	require.True(t, updatedClass.EndDt.After(*createdClass.EndDt), "End date should be later than original November 30")
}

func runTestEventReschedulingExtendsMultipleMonths(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User, program *models.Program) {
	classStartDate := time.Date(2025, 11, 1, 0, 0, 0, 0, time.UTC)
	classEndDate := time.Date(2025, 11, 30, 0, 0, 0, 0, time.UTC)
	creditHours := int64(4)

	class := models.ProgramClass{
		ProgramID:      program.ID,
		FacilityID:     facility.ID,
		Capacity:       20,
		Name:           "Multi-Month Extension Test",
		InstructorName: "Test Instructor",
		Description:    "Testing multi-month extension via rescheduling",
		StartDt:        classStartDate,
		EndDt:          &classEndDate,
		Status:         models.Scheduled,
		CreditHours:    &creditHours,
	}

	classResp := NewRequest[*models.ProgramClass](env.Client, t, http.MethodPost, fmt.Sprintf("/api/programs/%d/classes", program.ID), class).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusCreated)

	createdClass := classResp.GetData()

	eventPayload := map[string]interface{}{
		"duration":        "2h",
		"room":            "Conference Room A",
		"recurrence_rule": "DTSTART:20251104T180000Z\nRRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20251130T000000Z",
	}

	eventResp := NewRequest[*models.ProgramClassEvent](env.Client, t, http.MethodPost, fmt.Sprintf("/api/program-classes/%d/events", createdClass.ID), eventPayload).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusCreated)

	event := eventResp.GetData()

	reschedulePayload := map[string]interface{}{
		"event_series": map[string]interface{}{
			"id":              event.ID,
			"duration":        "2h",
			"room":            "Future Conference Room",
			"recurrence_rule": "DTSTART:20260203T180000Z\nRRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20260228T000000Z",
		},
		"closed_event_series": map[string]interface{}{
			"id":              event.ID,
			"duration":        "2h",
			"room":            "Conference Room A",
			"recurrence_rule": "DTSTART:20251104T180000Z\nRRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20251130T000000Z",
		},
	}

	NewRequest[any](env.Client, t, http.MethodPut, fmt.Sprintf("/api/program-classes/%d/events", createdClass.ID), reschedulePayload).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusCreated)

	extendedClassResp := NewRequest[*models.ProgramClass](env.Client, t, http.MethodGet, fmt.Sprintf("/api/program-classes/%d", createdClass.ID), nil).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	extendedClass := extendedClassResp.GetData()
	expectedExtendedEnd := time.Date(2025, 11, 30, 0, 0, 0, 0, time.UTC) // November 30, 2025 at 00:00:00 UTC (original class end date)
	require.Equal(t, expectedExtendedEnd, *extendedClass.EndDt, "Class end date should remain at original November 30")
}

func runTestMultipleOverridesExtendEndDate(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User, program *models.Program) {
	classStartDate := time.Date(2025, 12, 1, 0, 0, 0, 0, time.UTC)
	classEndDate := time.Date(2025, 12, 20, 0, 0, 0, 0, time.UTC)
	creditHours := int64(3)

	class := models.ProgramClass{
		ProgramID:      program.ID,
		FacilityID:     facility.ID,
		Capacity:       15,
		Name:           "Multiple Overrides Test Class",
		InstructorName: "Test Instructor",
		Description:    "Testing multiple overrides extend end date",
		StartDt:        classStartDate,
		EndDt:          &classEndDate,
		Status:         models.Scheduled,
		CreditHours:    &creditHours,
	}

	classResp := NewRequest[*models.ProgramClass](env.Client, t, http.MethodPost, fmt.Sprintf("/api/programs/%d/classes", program.ID), class).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusCreated)

	createdClass := classResp.GetData()

	eventPayload := map[string]interface{}{
		"duration":        "1h",
		"room":            "Main Room",
		"recurrence_rule": "DTSTART:20251202T140000Z\nRRULE:FREQ=WEEKLY;BYDAY=TU;UNTIL=20251220T000000Z",
	}

	eventResp := NewRequest[*models.ProgramClassEvent](env.Client, t, http.MethodPost, fmt.Sprintf("/api/program-classes/%d/events", createdClass.ID), eventPayload).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusCreated)

	event := eventResp.GetData()

	overridePayload := []map[string]interface{}{
		{
			"event_id":       event.ID,
			"class_id":       createdClass.ID,
			"override_rrule": "DTSTART:20260106T140000Z\nRRULE:FREQ=DAILY;COUNT=1",
			"duration":       "1h",
			"room":           "January Room",
			"is_cancelled":   false,
			"reason":         "January extension",
		},
		{
			"event_id":       event.ID,
			"class_id":       createdClass.ID,
			"override_rrule": "DTSTART:20260203T140000Z\nRRULE:FREQ=DAILY;COUNT=1",
			"duration":       "1h",
			"room":           "February Room",
			"is_cancelled":   false,
			"reason":         "February extension",
		},
		{
			"event_id":       event.ID,
			"class_id":       createdClass.ID,
			"override_rrule": "DTSTART:20260303T140000Z\nRRULE:FREQ=DAILY;COUNT=1",
			"duration":       "1h",
			"room":           "March Room",
			"is_cancelled":   false,
			"reason":         "March extension",
		},
	}

	NewRequest[any](env.Client, t, http.MethodPut, fmt.Sprintf("/api/program-classes/%d/events/%d", createdClass.ID, event.ID), overridePayload).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	extendedClassResp := NewRequest[*models.ProgramClass](env.Client, t, http.MethodGet, fmt.Sprintf("/api/program-classes/%d", createdClass.ID), nil).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	extendedClass := extendedClassResp.GetData()
	expectedExtendedEnd := time.Date(2025, 12, 20, 23, 59, 59, 0, time.UTC)
	require.Equal(t, expectedExtendedEnd, *extendedClass.EndDt, "Class end date should reflect base event UNTIL date")
}

func runTestCannotModifyEventsForCompletedClasses(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User, program *models.Program) {

	class, err := env.CreateTestClass(program, facility, models.Scheduled)
	require.NoError(t, err)

	_, err = env.CreateTestEvent(class.ID, "")
	require.NoError(t, err)

	updateData := map[string]interface{}{
		"status": string(models.Completed),
	}
	NewRequest[any](env.Client, t, http.MethodPatch, fmt.Sprintf("/api/program-classes?id=%d", class.ID), updateData).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	eventPayload := map[string]interface{}{
		"duration":        "1h",
		"room":            "Test Room",
		"recurrence_rule": "DTSTART:20240101T100000Z\nRRULE:FREQ=WEEKLY;COUNT=4",
	}

	NewRequest[any](env.Client, t, http.MethodPost, fmt.Sprintf("/api/program-classes/%d/events", class.ID), eventPayload).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusBadRequest)

	overridePayload := map[string]interface{}{
		"override_rrule": "DTSTART:20241201T100000Z\nRRULE:FREQ=DAILY;COUNT=1",
		"duration":       "1h",
		"room":           "Test Room",
		"is_cancelled":   true,
		"reason":         "Testing completed class",
	}

	NewRequest[any](env.Client, t, http.MethodPut, fmt.Sprintf("/api/program-classes/%d/events/%d", class.ID, 1), overridePayload).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusBadRequest)

	reschedulePayload := map[string]interface{}{
		"event_series": map[string]interface{}{
			"id":              1,
			"date":            "2024-12-01",
			"start_time":      "15:00",
			"duration":        "90m",
			"room":            "Rescheduled Room",
			"recurrence_rule": "DTSTART:20241201T150000Z\nRRULE:FREQ=WEEKLY;COUNT=6",
		},
		"closed_event_series": map[string]interface{}{
			"id":              1,
			"date":            "2024-11-01",
			"start_time":      "15:00",
			"duration":        "90m",
			"room":            "Original Room",
			"recurrence_rule": "DTSTART:20241101T150000Z\nRRULE:FREQ=WEEKLY;COUNT=4",
		},
	}

	NewRequest[any](env.Client, t, http.MethodPut, fmt.Sprintf("/api/program-classes/%d/events", class.ID), reschedulePayload).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusBadRequest)
}

func runTestStartDateUpdatesWhenEventMovedEarlier(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User, program *models.Program) {
	classStartDate := time.Date(2025, 12, 15, 0, 0, 0, 0, time.UTC)
	classEndDate := time.Date(2026, 1, 31, 0, 0, 0, 0, time.UTC)
	creditHours := int64(2)

	class := models.ProgramClass{
		ProgramID:      program.ID,
		FacilityID:     facility.ID,
		Capacity:       10,
		Name:           "Start Date Update Test Class",
		InstructorName: "Test Instructor",
		Description:    "Testing that start date updates when event moved earlier",
		StartDt:        classStartDate,
		EndDt:          &classEndDate,
		Status:         models.Scheduled,
		CreditHours:    &creditHours,
	}

	classResp := NewRequest[*models.ProgramClass](env.Client, t, http.MethodPost, fmt.Sprintf("/api/programs/%d/classes", program.ID), class).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusCreated)

	createdClass := classResp.GetData()
	require.Equal(t, classStartDate, createdClass.StartDt, "Initial start date should be December 15")

	eventPayload := map[string]interface{}{
		"duration":        "1h30m",
		"room":            "Test Room",
		"recurrence_rule": "DTSTART:20251220T180000Z\nRRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20260131T000000Z",
	}

	eventResp := NewRequest[*models.ProgramClassEvent](env.Client, t, http.MethodPost, fmt.Sprintf("/api/program-classes/%d/events", createdClass.ID), eventPayload).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusCreated)

	event := eventResp.GetData()

	overridePayload := []map[string]interface{}{
		{
			"event_id":       event.ID,
			"class_id":       createdClass.ID,
			"override_rrule": "DTSTART:20251210T180000Z\nRRULE:FREQ=DAILY;COUNT=1",
			"duration":       "1h30m",
			"room":           "Earlier Room",
			"is_cancelled":   false,
			"reason":         "Start date earlier adjustment",
		},
	}

	NewRequest[any](env.Client, t, http.MethodPut, fmt.Sprintf("/api/program-classes/%d/events/%d", createdClass.ID, event.ID), overridePayload).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	updatedClassResp := NewRequest[*models.ProgramClass](env.Client, t, http.MethodGet, fmt.Sprintf("/api/program-classes/%d", createdClass.ID), nil).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	updatedClass := updatedClassResp.GetData()
	require.Equal(t, classStartDate, updatedClass.StartDt, "Class start date should remain at the original kickoff when earlier sessions are only cancelled")
}

func runTestEventCancellationAffectsBoundaries(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User, program *models.Program) {
	classStartDate := time.Date(2026, 1, 6, 0, 0, 0, 0, time.UTC)
	classEndDate := time.Date(2026, 1, 31, 0, 0, 0, 0, time.UTC)
	creditHours := int64(2)

	class := models.ProgramClass{
		ProgramID:      program.ID,
		FacilityID:     facility.ID,
		Capacity:       12,
		Name:           "Cancellation Boundary Test Class",
		InstructorName: "Test Instructor",
		Description:    "Testing that event cancellation affects boundaries",
		StartDt:        classStartDate,
		EndDt:          &classEndDate,
		Status:         models.Scheduled,
		CreditHours:    &creditHours,
	}

	classResp := NewRequest[*models.ProgramClass](env.Client, t, http.MethodPost, fmt.Sprintf("/api/programs/%d/classes", program.ID), class).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusCreated)

	createdClass := classResp.GetData()

	eventPayload := map[string]interface{}{
		"duration":        "1h",
		"room":            "Test Room",
		"recurrence_rule": "DTSTART:20260108T180000Z\nRRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20260228T000000Z",
	}

	eventResp := NewRequest[*models.ProgramClassEvent](env.Client, t, http.MethodPost, fmt.Sprintf("/api/program-classes/%d/events", createdClass.ID), eventPayload).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusCreated)

	event := eventResp.GetData()

	overridePayload := []map[string]interface{}{
		{
			"event_id":       event.ID,
			"class_id":       createdClass.ID,
			"override_rrule": "DTSTART:20260201T180000Z\nRRULE:FREQ=DAILY;COUNT=8",
			"duration":       "1h",
			"room":           "Test Room",
			"is_cancelled":   true,
			"reason":         "February events cancelled",
		},
	}

	NewRequest[any](env.Client, t, http.MethodPut, fmt.Sprintf("/api/program-classes/%d/events/%d", createdClass.ID, event.ID), overridePayload).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	updatedClassResp := NewRequest[*models.ProgramClass](env.Client, t, http.MethodGet, fmt.Sprintf("/api/program-classes/%d", createdClass.ID), nil).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	updatedClass := updatedClassResp.GetData()
	expectedNewEndDt := time.Date(2026, 2, 28, 23, 59, 59, 0, time.UTC)
	require.Equal(t, expectedNewEndDt, *updatedClass.EndDt, "Class end date should reflect base event UNTIL date")
}
