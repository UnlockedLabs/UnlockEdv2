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

func TestProgramEngagementOverview(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Engagement Facility")
	require.NoError(t, err)

	program, err := env.CreateTestProgram("GED Prep", models.StateGrants,
		[]models.ProgramType{{ProgramType: models.Educational}}, nil, true, nil)
	require.NoError(t, err)
	class, err := env.CreateTestClass(program, facility, models.Active, nil)
	require.NoError(t, err)

	// 3 residents: one active, one completed-only (not active), one never enrolled
	// (usernames must be alphanumunicode: no hyphens/underscores)
	activeUser, err := env.CreateTestUser("activeres", models.Student, facility.ID, "")
	require.NoError(t, err)
	completedUser, err := env.CreateTestUser("completedres", models.Student, facility.ID, "")
	require.NoError(t, err)
	_, err = env.CreateTestUser("neverres", models.Student, facility.ID, "")
	require.NoError(t, err)

	now := time.Now()
	_, err = env.CreateTestEnrollmentWithDates(class.ID, activeUser.ID, models.Enrolled, now, nil)
	require.NoError(t, err)
	endedAt := now.Add(time.Hour)
	_, err = env.CreateTestEnrollmentWithDates(class.ID, completedUser.ID, models.EnrollmentCompleted, now, &endedAt)
	require.NoError(t, err)

	overview := NewRequest[models.ProgramEngagementOverview](env.Client, t, http.MethodGet,
		"/api/department-metrics/programs/engagement-overview?facility="+strconv.Itoa(int(facility.ID)), nil).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK).
		GetData()

	require.Equal(t, int64(3), overview.TotalResidents)
	require.Equal(t, int64(1), overview.ActiveResidents)
	// never-engaged = residents with ZERO enrollment rows ever -> only "never-res"
	require.Equal(t, int64(1), overview.NeverEngagedResidents)
	require.Len(t, overview.TopPrograms, 0) // below the >=5-enrollee threshold, so excluded
}
