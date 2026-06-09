package integration

import (
	"context"
	"testing"

	"UnlockEdv2/src/models"

	"github.com/stretchr/testify/require"
)

// TestGetTotalAdmins verifies the staff-account count that backs the
// "N staff accounts · not counted" sub-label on the Registered Residents card:
// only admin/staff roles are counted, residents are excluded, and the count is
// scoped to the requested facility.
func TestGetTotalAdmins(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Staff Count Facility")
	require.NoError(t, err)
	otherFacility, err := env.CreateTestFacility("Other Facility")
	require.NoError(t, err)

	// Residents at the facility — must NOT be counted as staff.
	_, err = env.CreateTestUser("res1", models.Student, facility.ID, "r1")
	require.NoError(t, err)
	_, err = env.CreateTestUser("res2", models.Student, facility.ID, "r2")
	require.NoError(t, err)

	// Staff at the facility — counted.
	_, err = env.CreateTestUser("fadmin1", models.FacilityAdmin, facility.ID, "")
	require.NoError(t, err)
	_, err = env.CreateTestUser("fadmin2", models.FacilityAdmin, facility.ID, "")
	require.NoError(t, err)
	_, err = env.CreateTestUser("dadmin", models.DepartmentAdmin, facility.ID, "")
	require.NoError(t, err)

	// System admin at the facility — platform-wide operator, NOT facility staff,
	// so it must be excluded from the count.
	_, err = env.CreateTestUser("sysadmin", models.SystemAdmin, facility.ID, "")
	require.NoError(t, err)

	// Staff at a different facility — must be excluded when scoped.
	_, err = env.CreateTestUser("otheradmin", models.FacilityAdmin, otherFacility.ID, "")
	require.NoError(t, err)

	args := &models.QueryContext{Ctx: context.Background()}

	scoped, err := env.DB.GetTotalAdmins(args, &facility.ID)
	require.NoError(t, err)
	require.Equal(t, int64(3), scoped, "should count only the 3 facility/department staff at the scoped facility, excluding residents, system admins, and other-facility staff")

	// Residents are still counted as residents, never as staff.
	residents, err := env.DB.GetTotalUsers(args, &facility.ID)
	require.NoError(t, err)
	require.Equal(t, int64(2), residents, "resident total should be unaffected by staff accounts")
}
