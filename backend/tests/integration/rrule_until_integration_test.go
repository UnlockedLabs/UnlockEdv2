package integration

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/handlers"
	"UnlockEdv2/src/models"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestClassCompletedAddsUntilDate(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Test Facility")
	require.NoError(t, err)

	facilityAdmin, err := env.CreateTestUser("admin", models.FacilityAdmin, facility.ID, "")
	require.NoError(t, err)

	program, err := env.CreateTestProgram("Test Program", models.FundingType(models.FederalGrants), []models.ProgramType{}, []models.ProgramCreditType{}, true, nil)
	require.NoError(t, err)

	err = env.SetFacilitiesToProgram(program.ID, []uint{facility.ID})
	require.NoError(t, err)

	class, err := env.CreateTestClass(program, facility, models.Active)
	require.NoError(t, err)

	indefiniteRRule := "DTSTART:20240101T100000Z\nRRULE:FREQ=WEEKLY;BYDAY=TU,TH"
	event, err := env.CreateTestEventWithRRule(class.ID, indefiniteRRule)
	require.NoError(t, err)

	originalRule, err := env.GetEventRecurrenceRule(event.ID)
	require.NoError(t, err)
	require.Equal(t, indefiniteRRule, originalRule)
	require.Empty(t, src.GetUntilDateFromRule(originalRule))

	completionTime := time.Now()
	updateData := map[string]any{
		"status": string(models.Completed),
	}

	NewRequest[any](env.Client, t, http.MethodPatch, fmt.Sprintf("/api/program-classes?id=%d", class.ID), updateData).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	updatedRule, err := env.GetEventRecurrenceRule(event.ID)
	require.NoError(t, err)
	require.Contains(t, updatedRule, "UNTIL=")

	untilDate := src.GetUntilDateFromRule(updatedRule)
	require.NotEmpty(t, untilDate)

	expectedUntilDate := src.FormatDateForUntil(completionTime)
	require.Equal(t, expectedUntilDate, untilDate)

	require.True(t, strings.HasSuffix(untilDate, "T235959Z"))
}

func TestClassCancelledAddsUntilDate(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Test Facility")
	require.NoError(t, err)

	facilityAdmin, err := env.CreateTestUser("admin", models.FacilityAdmin, facility.ID, "")
	require.NoError(t, err)

	program, err := env.CreateTestProgram("Test Program", models.FundingType(models.FederalGrants), []models.ProgramType{}, []models.ProgramCreditType{}, true, nil)
	require.NoError(t, err)

	err = env.SetFacilitiesToProgram(program.ID, []uint{facility.ID})
	require.NoError(t, err)

	class, err := env.CreateTestClass(program, facility, models.Active)
	require.NoError(t, err)

	indefiniteRRule := "DTSTART:20240715T150000Z\nRRULE:FREQ=DAILY;INTERVAL=2"
	event, err := env.CreateTestEventWithRRule(class.ID, indefiniteRRule)
	require.NoError(t, err)

	originalRule, err := env.GetEventRecurrenceRule(event.ID)
	require.NoError(t, err)
	require.Equal(t, indefiniteRRule, originalRule)
	require.Empty(t, src.GetUntilDateFromRule(originalRule))

	cancellationTime := time.Now()
	updateData := map[string]any{
		"status": string(models.Cancelled),
	}

	NewRequest[any](env.Client, t, http.MethodPatch, fmt.Sprintf("/api/program-classes?id=%d", class.ID), updateData).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	updatedRule, err := env.GetEventRecurrenceRule(event.ID)
	require.NoError(t, err)
	require.Contains(t, updatedRule, "UNTIL=")

	untilDate := src.GetUntilDateFromRule(updatedRule)
	require.NotEmpty(t, untilDate)

	expectedUntilDate := src.FormatDateForUntil(cancellationTime)
	require.Equal(t, expectedUntilDate, untilDate)

	require.True(t, strings.HasSuffix(untilDate, "T235959Z"))
}

func TestMultipleEventsGetUntilDate(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Test Facility")
	require.NoError(t, err)

	facilityAdmin, err := env.CreateTestUser("admin", models.FacilityAdmin, facility.ID, "")
	require.NoError(t, err)

	program, err := env.CreateTestProgram("Test Program", models.FundingType(models.FederalGrants), []models.ProgramType{}, []models.ProgramCreditType{}, true, nil)
	require.NoError(t, err)

	err = env.SetFacilitiesToProgram(program.ID, []uint{facility.ID})
	require.NoError(t, err)

	class, err := env.CreateTestClass(program, facility, models.Active)
	require.NoError(t, err)

	event1, err := env.CreateTestEventWithRRule(class.ID, "DTSTART:20240721T100000Z\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR")
	require.NoError(t, err)

	event2, err := env.CreateTestEventWithRRule(class.ID, "DTSTART:20240722T140000Z\nRRULE:FREQ=WEEKLY;BYDAY=TU,TH")
	require.NoError(t, err)

	rule1, err := env.GetEventRecurrenceRule(event1.ID)
	require.NoError(t, err)
	require.Empty(t, src.GetUntilDateFromRule(rule1))

	rule2, err := env.GetEventRecurrenceRule(event2.ID)
	require.NoError(t, err)
	require.Empty(t, src.GetUntilDateFromRule(rule2))

	completionTime := time.Now()
	updateData := map[string]any{
		"status": string(models.Completed),
	}

	NewRequest[any](env.Client, t, http.MethodPatch, fmt.Sprintf("/api/program-classes?id=%d", class.ID), updateData).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	updatedRule1, err := env.GetEventRecurrenceRule(event1.ID)
	require.NoError(t, err)
	require.Contains(t, updatedRule1, "UNTIL=")

	updatedRule2, err := env.GetEventRecurrenceRule(event2.ID)
	require.NoError(t, err)
	require.Contains(t, updatedRule2, "UNTIL=")

	untilDate1 := src.GetUntilDateFromRule(updatedRule1)
	untilDate2 := src.GetUntilDateFromRule(updatedRule2)

	expectedUntilDate := src.FormatDateForUntil(completionTime)
	require.Equal(t, expectedUntilDate, untilDate1)
	require.Equal(t, expectedUntilDate, untilDate2)
}

func TestExistingUntilDateReplaced(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Test Facility")
	require.NoError(t, err)

	facilityAdmin, err := env.CreateTestUser("admin", models.FacilityAdmin, facility.ID, "")
	require.NoError(t, err)

	program, err := env.CreateTestProgram("Test Program", models.FundingType(models.FederalGrants), []models.ProgramType{}, []models.ProgramCreditType{}, true, nil)
	require.NoError(t, err)

	err = env.SetFacilitiesToProgram(program.ID, []uint{facility.ID})
	require.NoError(t, err)

	class, err := env.CreateTestClass(program, facility, models.Active)
	require.NoError(t, err)

	futureDate := time.Now().AddDate(1, 0, 0)
	existingUntilDate := src.FormatDateForUntil(futureDate)
	ruleWithExistingUntil := fmt.Sprintf("DTSTART:20240721T100000Z\nRRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=%s", existingUntilDate)

	event, err := env.CreateTestEventWithRRule(class.ID, ruleWithExistingUntil)
	require.NoError(t, err)

	originalRule, err := env.GetEventRecurrenceRule(event.ID)
	require.NoError(t, err)
	require.Contains(t, originalRule, "UNTIL="+existingUntilDate)

	completionTime := time.Now()
	updateData := map[string]any{
		"status": string(models.Completed),
	}

	NewRequest[any](env.Client, t, http.MethodPatch, fmt.Sprintf("/api/program-classes?id=%d", class.ID), updateData).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	updatedRule, err := env.GetEventRecurrenceRule(event.ID)
	require.NoError(t, err)

	newUntilDate := src.GetUntilDateFromRule(updatedRule)
	expectedNewUntilDate := src.FormatDateForUntil(completionTime)
	
	require.Equal(t, expectedNewUntilDate, newUntilDate)
	require.NotEqual(t, existingUntilDate, newUntilDate)
	require.NotContains(t, updatedRule, existingUntilDate)
}