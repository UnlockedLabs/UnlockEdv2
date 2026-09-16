package integration

import (
	"UnlockEdv2/src/handlers"
	"UnlockEdv2/src/models"
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestSecondProgramEnrollment(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Second Enrollment Facility")
	require.NoError(t, err)

	progA, err := env.CreateTestProgram("Welding", models.StateGrants,
		[]models.ProgramType{{ProgramType: models.Vocational}}, nil, true, nil)
	require.NoError(t, err)
	progB, err := env.CreateTestProgram("Financial Literacy", models.StateGrants,
		[]models.ProgramType{{ProgramType: models.LifeSkills}}, nil, true, nil)
	require.NoError(t, err)
	classA, err := env.CreateTestClass(progA, facility, models.Active, nil)
	require.NoError(t, err)
	classB, err := env.CreateTestClass(progB, facility, models.Active, nil)
	require.NoError(t, err)

	user, err := env.CreateTestUser("repeatres", models.Student, facility.ID, "")
	require.NoError(t, err)
	otherUser, err := env.CreateTestUser("onceres", models.Student, facility.ID, "")
	require.NoError(t, err)
	earlyUser, err := env.CreateTestUser("earlyres", models.Student, facility.ID, "")
	require.NoError(t, err)

	completedAt := time.Now().Add(-48 * time.Hour)
	// user completes Vocational, then enrolls in LifeSkills AFTER completion -> counts
	_, err = env.CreateTestEnrollmentWithDates(classA.ID, user.ID, models.EnrollmentCompleted,
		completedAt.Add(-time.Hour), &completedAt)
	require.NoError(t, err)
	_, err = env.CreateTestEnrollmentWithDates(classB.ID, user.ID, models.Enrolled,
		completedAt.Add(time.Hour), nil)
	require.NoError(t, err)

	// otherUser completes Vocational but never enrolls again -> does not count
	otherCompletedAt := time.Now().Add(-24 * time.Hour)
	_, err = env.CreateTestEnrollmentWithDates(classA.ID, otherUser.ID, models.EnrollmentCompleted,
		otherCompletedAt.Add(-time.Hour), &otherCompletedAt)
	require.NoError(t, err)

	// earlyUser enrolls in LifeSkills BEFORE completing Vocational -> the LifeSkills
	// enrollment predates the completion, so it must NOT count as a "second enrollment"
	// triggered by that completion. This is the chronological-ordering fix under test:
	// a buggy implementation that ignores order would incorrectly count this as a hit.
	earlyCompletedAt := time.Now().Add(-12 * time.Hour)
	_, err = env.CreateTestEnrollmentWithDates(classB.ID, earlyUser.ID, models.Enrolled,
		earlyCompletedAt.Add(-time.Hour), nil)
	require.NoError(t, err)
	_, err = env.CreateTestEnrollmentWithDates(classA.ID, earlyUser.ID, models.EnrollmentCompleted,
		earlyCompletedAt.Add(-30*time.Minute), &earlyCompletedAt)
	require.NoError(t, err)

	// SystemAdmin can switch facilities, so getQueryContext defaults to
	// statewide (facility_id 0) unless a facility is named explicitly -
	// pass it via the "facility" param that resolveFacilityFilter reads.
	rows := NewRequest[[]models.SecondProgramEnrollmentRow](env.Client, t, http.MethodGet,
		"/api/department-metrics/programs/second-enrollment?facility="+strconv.Itoa(int(facility.ID)), nil).
		WithTestClaims(&handlers.Claims{Role: models.SystemAdmin, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK).
		GetData()

	require.Len(t, rows, 1)
	row := rows[0]
	require.Equal(t, "Second Enrollment Facility", row.FacilityName)
	require.Equal(t, "Vocational", row.ProgramType)
	require.Equal(t, int64(3), row.CompletedFirst)
	require.Equal(t, int64(1), row.EnrolledSecond)
	require.InDelta(t, 33.33, row.Rate, 0.01)
}
