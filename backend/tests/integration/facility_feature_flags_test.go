package integration

import (
	"UnlockEdv2/src/handlers"
	"UnlockEdv2/src/models"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFacilityFeatureAccess_EffectiveMatrix(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Feature Matrix Facility")
	require.NoError(t, err)

	statewide := []models.FeatureAccess{models.OpenContentAccess, models.ProgramAccess}
	args := &models.QueryContext{Ctx: env.Context}

	t.Run("no override inherits the statewide default", func(t *testing.T) {
		effective, err := env.DB.GetFacilityFeatureAccess(facility.ID, statewide)
		require.NoError(t, err)
		require.ElementsMatch(t, statewide, effective)
	})

	t.Run("facility override disables a statewide-enabled feature", func(t *testing.T) {
		require.NoError(t, env.DB.UpsertFacilityFeatureFlag(args, facility.ID, models.ProgramAccess, false, statewide))

		effective, err := env.DB.GetFacilityFeatureAccess(facility.ID, statewide)
		require.NoError(t, err)
		require.NotContains(t, effective, models.ProgramAccess)
		require.Contains(t, effective, models.OpenContentAccess)
	})

	t.Run("re-enabling the override restores it", func(t *testing.T) {
		require.NoError(t, env.DB.UpsertFacilityFeatureFlag(args, facility.ID, models.ProgramAccess, true, statewide))

		effective, err := env.DB.GetFacilityFeatureAccess(facility.ID, statewide)
		require.NoError(t, err)
		require.Contains(t, effective, models.ProgramAccess)
	})

	t.Run("a feature disabled statewide can never be enabled for a single facility", func(t *testing.T) {
		err := env.DB.UpsertFacilityFeatureFlag(args, facility.ID, models.LearningRecordAccess, true, statewide) // not in statewide slice
		require.Error(t, err)

		effective, err := env.DB.GetFacilityFeatureAccess(facility.ID, statewide)
		require.NoError(t, err)
		require.NotContains(t, effective, models.LearningRecordAccess)
	})
}

func TestFacilityFeatureAccess_SubFeatureGuard(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Sub Feature Facility")
	require.NoError(t, err)

	statewide := []models.FeatureAccess{models.OpenContentAccess, models.RequestContentAccess}
	args := &models.QueryContext{Ctx: env.Context}

	t.Run("enabling a sub-feature succeeds while its parent is enabled", func(t *testing.T) {
		require.NoError(t, env.DB.UpsertFacilityFeatureFlag(args, facility.ID, models.RequestContentAccess, true, statewide))
	})

	t.Run("disabling the parent, then re-enabling the sub-feature is rejected", func(t *testing.T) {
		require.NoError(t, env.DB.UpsertFacilityFeatureFlag(args, facility.ID, models.OpenContentAccess, false, statewide))
		require.NoError(t, env.DB.UpsertFacilityFeatureFlag(args, facility.ID, models.RequestContentAccess, false, statewide))

		err := env.DB.UpsertFacilityFeatureFlag(args, facility.ID, models.RequestContentAccess, true, statewide)
		require.Error(t, err)

		effective, err := env.DB.GetFacilityFeatureAccess(facility.ID, statewide)
		require.NoError(t, err)
		require.NotContains(t, effective, models.RequestContentAccess)
	})

	t.Run("disabling only the parent cascades to an untouched sub-feature", func(t *testing.T) {
		facility2, err := env.CreateTestFacility("Cascade Facility")
		require.NoError(t, err)

		require.NoError(t, env.DB.UpsertFacilityFeatureFlag(args, facility2.ID, models.OpenContentAccess, false, statewide))

		effective, err := env.DB.GetFacilityFeatureAccess(facility2.ID, statewide)
		require.NoError(t, err)
		require.NotContains(t, effective, models.OpenContentAccess)
		require.NotContains(t, effective, models.RequestContentAccess,
			"request_content was never explicitly disabled, but its parent is off, so it must not be effective")
	})
}

func TestApplyFacilityFeaturesToAll(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()

	source, err := env.CreateTestFacility("Source Facility")
	require.NoError(t, err)
	target1, err := env.CreateTestFacility("Target Facility 1")
	require.NoError(t, err)
	target2, err := env.CreateTestFacility("Target Facility 2")
	require.NoError(t, err)

	statewide := models.AllFeatures
	args := &models.QueryContext{Ctx: env.Context}

	require.NoError(t, env.DB.UpsertFacilityFeatureFlag(args, source.ID, models.ProgramAccess, false, statewide))
	require.NoError(t, env.DB.UpsertFacilityFeatureFlag(args, source.ID, models.UploadVideoAccess, false, statewide))

	require.NoError(t, env.DB.ApplyFacilityFeaturesToAll(args, source.ID, statewide))

	for _, target := range []*models.Facility{target1, target2} {
		effective, err := env.DB.GetFacilityFeatureAccess(target.ID, statewide)
		require.NoError(t, err)
		require.NotContains(t, effective, models.ProgramAccess, "top-level feature should propagate")
		require.NotContains(t, effective, models.UploadVideoAccess, "sub-feature should propagate too")
		require.Contains(t, effective, models.OpenContentAccess, "untouched features should remain on")
	}
}

// An unknown source facility has no override rows, so its effective set resolves
// to the untouched statewide defaults — and every real facility matches the
// `id != source` target filter. Without an existence check that silently resets
// every per-facility override in the system.
func TestApplyFacilityFeaturesToAll_UnknownSourceChangesNothing(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()

	target1, err := env.CreateTestFacility("Unknown Source Target 1")
	require.NoError(t, err)
	target2, err := env.CreateTestFacility("Unknown Source Target 2")
	require.NoError(t, err)

	statewide := models.AllFeatures
	args := &models.QueryContext{Ctx: env.Context}

	require.NoError(t, env.DB.UpsertFacilityFeatureFlag(args, target1.ID, models.ProgramAccess, false, statewide))
	require.NoError(t, env.DB.UpsertFacilityFeatureFlag(args, target2.ID, models.UploadVideoAccess, false, statewide))

	before := map[uint][]models.FeatureAccess{}
	for _, target := range []*models.Facility{target1, target2} {
		effective, err := env.DB.GetFacilityFeatureAccess(target.ID, statewide)
		require.NoError(t, err)
		before[target.ID] = effective
	}

	err = env.DB.ApplyFacilityFeaturesToAll(args, target2.ID+9999, statewide)
	require.Error(t, err, "an unknown source facility must be rejected")

	for _, target := range []*models.Facility{target1, target2} {
		effective, err := env.DB.GetFacilityFeatureAccess(target.ID, statewide)
		require.NoError(t, err)
		require.ElementsMatch(t, before[target.ID], effective,
			"no facility's overrides may change when the source facility doesn't exist")
	}
}

func TestFacilityFeatureRoutes_RoleGating(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Role Gating Facility")
	require.NoError(t, err)

	t.Run("facility admin cannot list the facility feature overview", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodGet, "/api/facilities/features", nil).
			WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, FacilityID: facility.ID}).
			Do().
			ExpectStatus(http.StatusUnauthorized)
	})

	t.Run("facility admin cannot toggle a facility feature", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodPut,
			fmt.Sprintf("/api/facilities/%d/features/%s", facility.ID, models.ProgramAccess),
			map[string]any{"enabled": false}).
			WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, FacilityID: facility.ID}).
			Do().
			ExpectStatus(http.StatusUnauthorized)
	})

	t.Run("department admin can toggle a facility feature", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodPut,
			fmt.Sprintf("/api/facilities/%d/features/%s", facility.ID, models.ProgramAccess),
			map[string]any{"enabled": false}).
			WithTestClaims(&handlers.Claims{Role: models.DepartmentAdmin}).
			Do().
			ExpectStatus(http.StatusOK)
	})

	t.Run("system admin can view the facility feature detail panel", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodGet,
			fmt.Sprintf("/api/facilities/%d/features", facility.ID), nil).
			WithTestClaims(&handlers.Claims{Role: models.SystemAdmin}).
			Do().
			ExpectStatus(http.StatusOK)
	})

	t.Run("invalid feature name is rejected with a 400, not a 500", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodPut,
			fmt.Sprintf("/api/facilities/%d/features/not_a_real_feature", facility.ID),
			map[string]any{"enabled": true}).
			WithTestClaims(&handlers.Claims{Role: models.SystemAdmin}).
			Do().
			ExpectStatus(http.StatusBadRequest)
	})
}

func TestFacilityFeatureRoutes_ApplyAll(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()

	source, err := env.CreateTestFacility("Apply-All Source")
	require.NoError(t, err)
	_, err = env.CreateTestFacility("Apply-All Target")
	require.NoError(t, err)

	t.Run("department admin can apply a facility's settings to all others", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodPut, "/api/facilities/features/apply-all",
			map[string]any{"source_facility_id": source.ID}).
			WithTestClaims(&handlers.Claims{Role: models.DepartmentAdmin}).
			Do().
			ExpectStatus(http.StatusOK)
	})

	t.Run("facility admin cannot apply to all", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodPut, "/api/facilities/features/apply-all",
			map[string]any{"source_facility_id": source.ID}).
			WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, FacilityID: source.ID}).
			Do().
			ExpectStatus(http.StatusUnauthorized)
	})

	t.Run("a nonexistent source facility is rejected, not treated as statewide defaults", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodPut, "/api/facilities/features/apply-all",
			map[string]any{"source_facility_id": source.ID + 9999}).
			WithTestClaims(&handlers.Claims{Role: models.DepartmentAdmin}).
			Do().
			ExpectStatus(http.StatusBadRequest)
	})
}

// An omitted `enabled` property must not decode as `false` and silently disable
// the feature. An explicit `false` must still be honored.
func TestFacilityFeatureRoutes_EnabledRequired(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Enabled Required Facility")
	require.NoError(t, err)

	statewide := models.AllFeatures

	t.Run("a body without enabled is rejected and changes nothing", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodPut,
			fmt.Sprintf("/api/facilities/%d/features/%s", facility.ID, models.ProgramAccess),
			map[string]any{}).
			WithTestClaims(&handlers.Claims{Role: models.SystemAdmin}).
			Do().
			ExpectStatus(http.StatusBadRequest)

		effective, err := env.DB.GetFacilityFeatureAccess(facility.ID, statewide)
		require.NoError(t, err)
		require.Contains(t, effective, models.ProgramAccess, "the rejected request must not have written an override")
	})

	t.Run("an explicit false is still accepted", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodPut,
			fmt.Sprintf("/api/facilities/%d/features/%s", facility.ID, models.ProgramAccess),
			map[string]any{"enabled": false}).
			WithTestClaims(&handlers.Claims{Role: models.SystemAdmin}).
			Do().
			ExpectStatus(http.StatusOK)

		effective, err := env.DB.GetFacilityFeatureAccess(facility.ID, statewide)
		require.NoError(t, err)
		require.NotContains(t, effective, models.ProgramAccess)
	})
}

// TestFeatureFlags_MiddlewareEnforcesClaims proves the core regression this
// feature fixes: a route gated on a feature must reject a request whose claims
// don't carry that feature, not just record the toggle in the database. Claims
// here stand in for what auth.go's per-facility resolution would have produced.
func TestFeatureFlags_MiddlewareEnforcesClaims(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Enforcement Facility")
	require.NoError(t, err)

	t.Run("student without program access is rejected from a program-gated route", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodGet, "/api/programs", nil).
			WithTestClaims(&handlers.Claims{
				Role:          models.Student,
				FacilityID:    facility.ID,
				FeatureAccess: []models.FeatureAccess{},
			}).
			Do().
			ExpectStatus(http.StatusUnauthorized)
	})

	t.Run("student with program access succeeds on the same route", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodGet, "/api/programs", nil).
			WithTestClaims(&handlers.Claims{
				Role:          models.Student,
				FacilityID:    facility.ID,
				FeatureAccess: []models.FeatureAccess{models.ProgramAccess},
			}).
			Do().
			ExpectStatus(http.StatusOK)
	})
}
