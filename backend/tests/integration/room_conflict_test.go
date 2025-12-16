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

func TestRoomConflictDetection(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Conflict Test Facility")
	require.NoError(t, err)

	facilityAdmin, err := env.CreateTestUser("conflictadmin", models.FacilityAdmin, facility.ID, "")
	require.NoError(t, err)

	program, err := env.CreateTestProgram("Conflict Test Program", models.FundingType(models.FederalGrants), []models.ProgramType{}, []models.ProgramCreditType{}, true, nil)
	require.NoError(t, err)

	err = env.SetFacilitiesToProgram(program.ID, []uint{facility.ID})
	require.NoError(t, err)

	t.Run("Detects overlapping bookings", func(t *testing.T) {
		room := &models.Room{FacilityID: facility.ID, Name: "Conflict Room 1"}
		require.NoError(t, env.DB.Create(room).Error)
		testDetectsOverlappingBookings(t, env, facility, facilityAdmin, program, room.ID)
	})

	t.Run("Excludes own event ID when updating", func(t *testing.T) {
		room := &models.Room{FacilityID: facility.ID, Name: "Conflict Room 2"}
		require.NoError(t, env.DB.Create(room).Error)
		testExcludesOwnEventID(t, env, facility, facilityAdmin, program, room.ID)
	})

	t.Run("No conflict for different times", func(t *testing.T) {
		room := &models.Room{FacilityID: facility.ID, Name: "Conflict Room 3"}
		require.NoError(t, env.DB.Create(room).Error)
		testNoConflictForDifferentTimes(t, env, facility, facilityAdmin, program, room.ID)
	})

	t.Run("Handler returns 409 on room conflict", func(t *testing.T) {
		room := &models.Room{FacilityID: facility.ID, Name: "Conflict Room 4"}
		require.NoError(t, env.DB.Create(room).Error)
		testHandlerReturns409OnConflict(t, env, facility, facilityAdmin, program, room.ID)
	})

	t.Run("Rejects room from different facility", func(t *testing.T) {
		otherFacility, err := env.CreateTestFacility("Other Facility")
		require.NoError(t, err)
		otherRoom := &models.Room{FacilityID: otherFacility.ID, Name: "Other Room"}
		require.NoError(t, env.DB.Create(otherRoom).Error)
		testRejectsRoomFromDifferentFacility(t, env, facility, facilityAdmin, program, otherRoom.ID)
	})
}

func testDetectsOverlappingBookings(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User, program *models.Program, roomID uint) {
	classStartDate := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	classEndDate := time.Date(2026, 3, 31, 0, 0, 0, 0, time.UTC)
	creditHours := int64(2)

	class1 := models.ProgramClass{
		ProgramID:      program.ID,
		FacilityID:     facility.ID,
		Capacity:       10,
		Name:           "First Class",
		InstructorName: "Instructor 1",
		Description:    "First class to book the room",
		StartDt:        classStartDate,
		EndDt:          &classEndDate,
		Status:         models.Scheduled,
		CreditHours:    &creditHours,
	}

	class1Resp := NewRequest[*models.ProgramClass](env.Client, t, http.MethodPost, fmt.Sprintf("/api/programs/%d/classes", program.ID), class1).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusCreated)

	createdClass1 := class1Resp.GetData()

	event1Payload := map[string]interface{}{
		"duration":        "2h",
		"room_id":         roomID,
		"recurrence_rule": "DTSTART:20260302T090000Z\nRRULE:FREQ=DAILY;UNTIL=20260331T000000Z",
	}

	NewRequest[any](env.Client, t, http.MethodPost, fmt.Sprintf("/api/program-classes/%d/events", createdClass1.ID), event1Payload).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusCreated)

	conflicts, err := env.DB.CheckRRuleConflicts(&models.ConflictCheckRequest{
		FacilityID:     facility.ID,
		RoomID:         roomID,
		RecurrenceRule: "DTSTART:20260302T093000Z\nRRULE:FREQ=DAILY;UNTIL=20260310T000000Z",
		Duration:       "1h",
	})
	require.NoError(t, err)
	require.NotEmpty(t, conflicts, "Should detect conflicts for overlapping times")
	require.Equal(t, "First Class", conflicts[0].ClassName, "Conflict should identify the class name")
}

func testExcludesOwnEventID(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User, program *models.Program, roomID uint) {
	classStartDate := time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC)
	classEndDate := time.Date(2026, 4, 30, 0, 0, 0, 0, time.UTC)
	creditHours := int64(2)

	class := models.ProgramClass{
		ProgramID:      program.ID,
		FacilityID:     facility.ID,
		Capacity:       10,
		Name:           "Self Update Class",
		InstructorName: "Instructor",
		Description:    "Class for testing self-exclusion",
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
		"room_id":         roomID,
		"recurrence_rule": "DTSTART:20260402T140000Z\nRRULE:FREQ=DAILY;UNTIL=20260430T000000Z",
	}

	NewRequest[any](env.Client, t, http.MethodPost, fmt.Sprintf("/api/program-classes/%d/events", createdClass.ID), eventPayload).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusCreated)

	var event models.ProgramClassEvent
	err := env.DB.Where("class_id = ?", createdClass.ID).First(&event).Error
	require.NoError(t, err)

	conflictsWithoutExclusion, err := env.DB.CheckRRuleConflicts(&models.ConflictCheckRequest{
		FacilityID:     facility.ID,
		RoomID:         roomID,
		RecurrenceRule: "DTSTART:20260402T140000Z\nRRULE:FREQ=DAILY;UNTIL=20260410T000000Z",
		Duration:       "2h",
	})
	require.NoError(t, err)
	require.NotEmpty(t, conflictsWithoutExclusion, "Should detect conflicts when not excluding own event")

	conflictsWithExclusion, err := env.DB.CheckRRuleConflicts(&models.ConflictCheckRequest{
		FacilityID:     facility.ID,
		RoomID:         roomID,
		RecurrenceRule: "DTSTART:20260402T140000Z\nRRULE:FREQ=DAILY;UNTIL=20260410T000000Z",
		Duration:       "2h",
		ExcludeEventID: &event.ID,
	})
	require.NoError(t, err)
	require.Empty(t, conflictsWithExclusion, "Should NOT detect conflicts when excluding own event ID")
}

func testNoConflictForDifferentTimes(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User, program *models.Program, roomID uint) {
	classStartDate := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
	classEndDate := time.Date(2026, 5, 31, 0, 0, 0, 0, time.UTC)
	creditHours := int64(2)

	class := models.ProgramClass{
		ProgramID:      program.ID,
		FacilityID:     facility.ID,
		Capacity:       10,
		Name:           "Morning Class",
		InstructorName: "Instructor",
		Description:    "Morning class",
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
		"room_id":         roomID,
		"recurrence_rule": "DTSTART:20260504T090000Z\nRRULE:FREQ=DAILY;UNTIL=20260531T000000Z",
	}

	NewRequest[any](env.Client, t, http.MethodPost, fmt.Sprintf("/api/program-classes/%d/events", createdClass.ID), eventPayload).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusCreated)

	conflicts, err := env.DB.CheckRRuleConflicts(&models.ConflictCheckRequest{
		FacilityID:     facility.ID,
		RoomID:         roomID,
		RecurrenceRule: "DTSTART:20260504T140000Z\nRRULE:FREQ=DAILY;UNTIL=20260510T000000Z",
		Duration:       "2h",
	})
	require.NoError(t, err)
	require.Empty(t, conflicts, "Should NOT detect conflicts for non-overlapping times (9-11 AM vs 2-4 PM)")
}

func testHandlerReturns409OnConflict(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User, program *models.Program, roomID uint) {
	classStartDate := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	classEndDate := time.Date(2026, 6, 30, 0, 0, 0, 0, time.UTC)
	creditHours := int64(2)

	class1 := models.ProgramClass{
		ProgramID:      program.ID,
		FacilityID:     facility.ID,
		Capacity:       10,
		Name:           "Existing Class",
		InstructorName: "Instructor 1",
		Description:    "Class that already has the room",
		StartDt:        classStartDate,
		EndDt:          &classEndDate,
		Status:         models.Scheduled,
		CreditHours:    &creditHours,
	}

	class1Resp := NewRequest[*models.ProgramClass](env.Client, t, http.MethodPost, fmt.Sprintf("/api/programs/%d/classes", program.ID), class1).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusCreated)

	createdClass1 := class1Resp.GetData()

	event1Payload := map[string]interface{}{
		"duration":        "2h",
		"room_id":         roomID,
		"recurrence_rule": "DTSTART:20260601T100000Z\nRRULE:FREQ=DAILY;UNTIL=20260630T000000Z",
	}

	NewRequest[any](env.Client, t, http.MethodPost, fmt.Sprintf("/api/program-classes/%d/events", createdClass1.ID), event1Payload).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusCreated)

	class2 := models.ProgramClass{
		ProgramID:      program.ID,
		FacilityID:     facility.ID,
		Capacity:       10,
		Name:           "Conflicting Class",
		InstructorName: "Instructor 2",
		Description:    "Class that tries to book the same room",
		StartDt:        classStartDate,
		EndDt:          &classEndDate,
		Status:         models.Scheduled,
		CreditHours:    &creditHours,
	}

	class2Resp := NewRequest[*models.ProgramClass](env.Client, t, http.MethodPost, fmt.Sprintf("/api/programs/%d/classes", program.ID), class2).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusCreated)

	createdClass2 := class2Resp.GetData()

	conflictingEventPayload := map[string]interface{}{
		"duration":        "1h",
		"room_id":         roomID,
		"recurrence_rule": "DTSTART:20260601T103000Z\nRRULE:FREQ=DAILY;UNTIL=20260610T000000Z",
	}

	NewRequest[any](env.Client, t, http.MethodPost, fmt.Sprintf("/api/program-classes/%d/events", createdClass2.ID), conflictingEventPayload).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusConflict)
}

func testRejectsRoomFromDifferentFacility(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User, program *models.Program, otherFacilityRoomID uint) {
	classStartDate := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	classEndDate := time.Date(2026, 7, 31, 0, 0, 0, 0, time.UTC)
	creditHours := int64(2)

	class := models.ProgramClass{
		ProgramID:      program.ID,
		FacilityID:     facility.ID,
		Capacity:       10,
		Name:           "Security Test Class",
		InstructorName: "Instructor",
		Description:    "Class trying to use room from different facility",
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
		"room_id":         otherFacilityRoomID,
		"recurrence_rule": "DTSTART:20260702T100000Z\nRRULE:FREQ=DAILY;UNTIL=20260731T000000Z",
	}

	NewRequest[any](env.Client, t, http.MethodPost, fmt.Sprintf("/api/program-classes/%d/events", createdClass.ID), eventPayload).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusBadRequest)
}
