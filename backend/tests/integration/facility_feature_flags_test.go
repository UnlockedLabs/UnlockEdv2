package integration

import (
	"UnlockEdv2/src/handlers"
	"UnlockEdv2/src/models"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

// seedGlobalFeatureFlags populates the global feature_flags + page_feature_flags
// tables with the same state the production migrations create: open_content,
// provider_platforms and program_management enabled statewide, learning_record
// disabled, and open_content's three page sub-features (request_content,
// helpful_links, upload_video) enabled. The in-memory test DB is created by
// AutoMigrate with empty tables, so every feature-flag test seeds this first.
func seedGlobalFeatureFlags(t *testing.T, env *TestEnv) {
	t.Helper()
	flags := []models.FeatureFlags{
		{Name: models.OpenContentAccess, Enabled: true},
		{Name: models.ProviderAccess, Enabled: true},
		{Name: models.ProgramAccess, Enabled: true},
		{Name: models.LearningRecordAccess, Enabled: false},
	}
	for i := range flags {
		require.NoError(t, env.DB.Create(&flags[i]).Error, "failed to seed feature flag")
	}
	var openContent models.FeatureFlags
	require.NoError(t, env.DB.Where("name = ?", models.OpenContentAccess).First(&openContent).Error)
	pageFlags := []models.PageFeatureFlags{
		{FeatureFlagID: openContent.ID, PageFeature: models.RequestContentAccess, Enabled: true},
		{FeatureFlagID: openContent.ID, PageFeature: models.HelpfulLinksAccess, Enabled: true},
		{FeatureFlagID: openContent.ID, PageFeature: models.UploadVideoAccess, Enabled: true},
	}
	for i := range pageFlags {
		require.NoError(t, env.DB.Create(&pageFlags[i]).Error, "failed to seed page feature flag")
	}
}

func deptAdminClaims() *handlers.Claims {
	return &handlers.Claims{Role: models.DepartmentAdmin}
}

// findStatus locates one facility's row in the overview list by ID.
func findStatus(statuses []models.FacilityFeatureStatus, facilityID uint) (models.FacilityFeatureStatus, bool) {
	for _, s := range statuses {
		if s.FacilityID == facilityID {
			return s, true
		}
	}
	return models.FacilityFeatureStatus{}, false
}

// featureState reads the effective on/off state of one feature from a status row.
func featureState(s models.FacilityFeatureStatus, feature models.FeatureAccess) (bool, bool) {
	for _, f := range s.Features {
		if f.Feature == feature {
			return f.Enabled, true
		}
	}
	return false, false
}

// detailItem finds a top-level feature item in the detail payload.
func detailItem(detail models.FacilityFeatureDetail, feature models.FeatureAccess) (models.FacilityFeatureDetailItem, bool) {
	for _, item := range detail.Features {
		if item.Feature == feature {
			return item, true
		}
	}
	return models.FacilityFeatureDetailItem{}, false
}

func TestFacilityFeatureFlagsOverview(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()
	seedGlobalFeatureFlags(t, env)

	facility, err := env.CreateTestFacility("Alpha Facility")
	require.NoError(t, err)

	t.Run("no overrides inherits the global set", func(t *testing.T) {
		resp := NewRequest[[]models.FacilityFeatureStatus](env.Client, t, http.MethodGet, "/api/facilities/features", nil).
			WithTestClaims(deptAdminClaims()).
			Do().
			ExpectStatus(http.StatusOK)

		statuses := resp.GetData()
		status, ok := findStatus(statuses, facility.ID)
		require.True(t, ok, "seeded facility should appear in the overview")

		// Universe = globally-enabled TopLevelFacilityFeatures = open_content +
		// program_management (learning_record is globally off, provider_platforms
		// is not per-facility manageable).
		require.Equal(t, 2, status.TotalCount)
		require.Equal(t, 2, status.EnabledCount, "with no overrides both features inherit on")

		oc, ok := featureState(status, models.OpenContentAccess)
		require.True(t, ok)
		require.True(t, oc)
		pm, ok := featureState(status, models.ProgramAccess)
		require.True(t, ok)
		require.True(t, pm)

		// learning_record is globally off, so it is absent from the manageable universe.
		_, ok = featureState(status, models.LearningRecordAccess)
		require.False(t, ok, "globally-disabled feature is excluded from the overview")
	})

	t.Run("a disable override lowers the count", func(t *testing.T) {
		require.NoError(t, env.DB.ToggleFacilityFeature(facility.ID, models.ProgramAccess, false))

		resp := NewRequest[[]models.FacilityFeatureStatus](env.Client, t, http.MethodGet, "/api/facilities/features", nil).
			WithTestClaims(deptAdminClaims()).
			Do().
			ExpectStatus(http.StatusOK)

		status, ok := findStatus(resp.GetData(), facility.ID)
		require.True(t, ok)
		require.Equal(t, 1, status.EnabledCount, "program_management now off")

		pm, _ := featureState(status, models.ProgramAccess)
		require.False(t, pm)
		oc, _ := featureState(status, models.OpenContentAccess)
		require.True(t, oc, "open_content unaffected")
	})
}

func TestFacilityFeatureFlagsOverviewFilter(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()
	seedGlobalFeatureFlags(t, env)

	on, err := env.CreateTestFacility("On Facility")
	require.NoError(t, err)
	off, err := env.CreateTestFacility("Off Facility")
	require.NoError(t, err)
	// Disable program_management only at the "off" facility.
	require.NoError(t, env.DB.ToggleFacilityFeature(off.ID, models.ProgramAccess, false))

	t.Run("filter program_management=false returns only the disabled facility", func(t *testing.T) {
		resp := NewRequest[[]models.FacilityFeatureStatus](env.Client, t, http.MethodGet,
			"/api/facilities/features?feature=program_management&enabled=false", nil).
			WithTestClaims(deptAdminClaims()).
			Do().
			ExpectStatus(http.StatusOK)

		statuses := resp.GetData()
		_, hasOff := findStatus(statuses, off.ID)
		_, hasOn := findStatus(statuses, on.ID)
		require.True(t, hasOff, "off facility matches enabled=false")
		require.False(t, hasOn, "on facility should be filtered out")
	})

	t.Run("filter program_management=true excludes the disabled facility", func(t *testing.T) {
		resp := NewRequest[[]models.FacilityFeatureStatus](env.Client, t, http.MethodGet,
			"/api/facilities/features?feature=program_management&enabled=true", nil).
			WithTestClaims(deptAdminClaims()).
			Do().
			ExpectStatus(http.StatusOK)

		statuses := resp.GetData()
		_, hasOff := findStatus(statuses, off.ID)
		_, hasOn := findStatus(statuses, on.ID)
		require.False(t, hasOff, "off facility should be filtered out")
		require.True(t, hasOn, "on facility matches enabled=true")
	})

	t.Run("filter on a globally-disabled feature returns nothing when enabled=true", func(t *testing.T) {
		resp := NewRequest[[]models.FacilityFeatureStatus](env.Client, t, http.MethodGet,
			"/api/facilities/features?feature=learning_record&enabled=true", nil).
			WithTestClaims(deptAdminClaims()).
			Do().
			ExpectStatus(http.StatusOK)

		require.Empty(t, resp.GetData(), "learning_record is off everywhere")
	})
}

func TestFacilityFeatureDetail(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()
	seedGlobalFeatureFlags(t, env)

	facility, err := env.CreateTestFacility("Detail Facility")
	require.NoError(t, err)

	resp := NewRequest[models.FacilityFeatureDetail](env.Client, t, http.MethodGet,
		fmt.Sprintf("/api/facilities/%d/features", facility.ID), nil).
		WithTestClaims(deptAdminClaims()).
		Do().
		ExpectStatus(http.StatusOK)

	detail := resp.GetData()
	require.Equal(t, facility.ID, detail.FacilityID)
	// All manageable top-level features are present regardless of global state.
	require.Len(t, detail.Features, len(models.TopLevelFacilityFeatures))

	oc, ok := detailItem(detail, models.OpenContentAccess)
	require.True(t, ok)
	require.True(t, oc.GloballyEnabled)
	require.True(t, oc.Enabled)
	require.Len(t, oc.PageFeatures, 3, "open_content exposes its three page sub-features")

	lr, ok := detailItem(detail, models.LearningRecordAccess)
	require.True(t, ok)
	require.False(t, lr.GloballyEnabled, "globally-disabled feature reports GloballyEnabled=false")
	require.False(t, lr.Enabled)

	pm, ok := detailItem(detail, models.ProgramAccess)
	require.True(t, ok)
	require.True(t, pm.GloballyEnabled)
	require.True(t, pm.Enabled)
}

func TestToggleFacilityFeatureRoundTrip(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()
	seedGlobalFeatureFlags(t, env)

	facility, err := env.CreateTestFacility("Toggle Facility")
	require.NoError(t, err)

	toggle := func(feature models.FeatureAccess, enabled bool) *Response[any] {
		body := map[string]bool{"enabled": enabled}
		return NewRequest[any](env.Client, t, http.MethodPut,
			fmt.Sprintf("/api/facilities/%d/features/%s", facility.ID, feature), body).
			WithTestClaims(deptAdminClaims()).
			Do()
	}

	// Effective set starts as the full inherit; disable program_management.
	toggle(models.ProgramAccess, false).
		ExpectStatus(http.StatusOK).
		ExpectMessage("facility feature toggled successfully")

	features, err := env.DB.GetFacilityFeatureAccess(facility.ID)
	require.NoError(t, err)
	require.NotContains(t, features, models.ProgramAccess, "disable persisted to the effective set")
	require.Contains(t, features, models.OpenContentAccess, "open_content still inherited")

	// Re-enable it and confirm it comes back.
	toggle(models.ProgramAccess, true).ExpectStatus(http.StatusOK)

	features, err = env.DB.GetFacilityFeatureAccess(facility.ID)
	require.NoError(t, err)
	require.Contains(t, features, models.ProgramAccess, "re-enable restored the feature")
}

func TestToggleFacilityFeatureGuards(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()
	seedGlobalFeatureFlags(t, env)

	facility, err := env.CreateTestFacility("Guarded Facility")
	require.NoError(t, err)

	put := func(feature models.FeatureAccess, enabled bool) *Response[any] {
		body := map[string]bool{"enabled": enabled}
		return NewRequest[any](env.Client, t, http.MethodPut,
			fmt.Sprintf("/api/facilities/%d/features/%s", facility.ID, feature), body).
			WithTestClaims(deptAdminClaims()).
			Do()
	}

	t.Run("cannot enable a feature disabled statewide", func(t *testing.T) {
		put(models.LearningRecordAccess, true).
			ExpectStatus(http.StatusBadRequest).
			ExpectBodyContains("disabled statewide")
	})

	t.Run("cannot enable a sub-feature while its parent is off", func(t *testing.T) {
		// Disabling the parent at the facility is always allowed.
		put(models.OpenContentAccess, false).ExpectStatus(http.StatusOK)
		put(models.RequestContentAccess, true).
			ExpectStatus(http.StatusBadRequest).
			ExpectBodyContains("parent is off")
	})
}

func TestFacilityFeatureIsolation(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()
	seedGlobalFeatureFlags(t, env)

	facilityA, err := env.CreateTestFacility("Isolation A")
	require.NoError(t, err)
	facilityB, err := env.CreateTestFacility("Isolation B")
	require.NoError(t, err)

	// Disable program_management at A only.
	NewRequest[any](env.Client, t, http.MethodPut,
		fmt.Sprintf("/api/facilities/%d/features/%s", facilityA.ID, models.ProgramAccess),
		map[string]bool{"enabled": false}).
		WithTestClaims(deptAdminClaims()).
		Do().
		ExpectStatus(http.StatusOK)

	// B's detail is unaffected.
	resp := NewRequest[models.FacilityFeatureDetail](env.Client, t, http.MethodGet,
		fmt.Sprintf("/api/facilities/%d/features", facilityB.ID), nil).
		WithTestClaims(deptAdminClaims()).
		Do().
		ExpectStatus(http.StatusOK)

	pm, ok := detailItem(resp.GetData(), models.ProgramAccess)
	require.True(t, ok)
	require.True(t, pm.Enabled, "toggling facility A must not affect facility B")

	// And the resolver agrees at the DB layer.
	aFeatures, err := env.DB.GetFacilityFeatureAccess(facilityA.ID)
	require.NoError(t, err)
	require.NotContains(t, aFeatures, models.ProgramAccess)

	bFeatures, err := env.DB.GetFacilityFeatureAccess(facilityB.ID)
	require.NoError(t, err)
	require.Contains(t, bFeatures, models.ProgramAccess)
}

func TestFacilityFeatureRoutesRequireDeptAdmin(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()
	seedGlobalFeatureFlags(t, env)

	facility, err := env.CreateTestFacility("RBAC Facility")
	require.NoError(t, err)

	// A facility admin cannot switch facilities, so the dept-admin routes reject them.
	NewRequest[[]models.FacilityFeatureStatus](env.Client, t, http.MethodGet, "/api/facilities/features", nil).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusUnauthorized)
}

// TestFeatureEnforcementReadsClaims confirms checkFeatureAccessMiddleware now
// gates on Claims.FeatureAccess (the per-facility set resolved at login) rather
// than the global srv.features cache. A pinned user whose resolved set omits a
// feature is blocked from that feature's routes; a user whose set includes it
// passes.
func TestFeatureEnforcementReadsClaims(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()

	t.Run("restricted feature set is blocked", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodGet, "/api/helpful-links", nil).
			WithTestClaims(&handlers.Claims{
				Role:          models.Student,
				FacilityID:    1,
				FeatureAccess: []models.FeatureAccess{models.ProgramAccess}, // omits helpful_links
			}).
			Do().
			ExpectStatus(http.StatusUnauthorized).
			ExpectBodyContains("Feature not enabled")
	})

	t.Run("granted feature set passes the gate", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodGet, "/api/helpful-links", nil).
			WithTestClaims(&handlers.Claims{
				Role:          models.Student,
				FacilityID:    1,
				FeatureAccess: []models.FeatureAccess{models.HelpfulLinksAccess},
			}).
			Do().
			ExpectStatus(http.StatusOK)
	})
}

// TestToggleFacilityFeatureCreatesExplicitTrueRow exercises the Create branch of
// ToggleFacilityFeature's upsert: with no prior override row, enabling a feature
// must write an explicit enabled=true row rather than lean on the DB default.
// (The disable->enable Save branch is covered by the round-trip test.)
func TestToggleFacilityFeatureCreatesExplicitTrueRow(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()
	seedGlobalFeatureFlags(t, env)

	facility, err := env.CreateTestFacility("Explicit True Facility")
	require.NoError(t, err)

	NewRequest[any](env.Client, t, http.MethodPut,
		fmt.Sprintf("/api/facilities/%d/features/%s", facility.ID, models.ProgramAccess),
		map[string]bool{"enabled": true}).
		WithTestClaims(deptAdminClaims()).
		Do().
		ExpectStatus(http.StatusOK)

	var row models.FacilityFeatureFlag
	require.NoError(t, env.DB.
		Where("facility_id = ? AND feature = ?", facility.ID, models.ProgramAccess).
		First(&row).Error, "an explicit override row should exist")
	require.True(t, row.Enabled, "the row must be an explicit enabled=true override")
}

// TestFacilityFeatureDetailReflectsDisabledPageFeature confirms that disabling a
// page sub-feature at a facility surfaces in the detail payload: the nested page
// feature reports Enabled=false while its (still-on) parent and GloballyEnabled
// are unaffected.
func TestFacilityFeatureDetailReflectsDisabledPageFeature(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()
	seedGlobalFeatureFlags(t, env)

	facility, err := env.CreateTestFacility("Page Feature Facility")
	require.NoError(t, err)

	require.NoError(t, env.DB.ToggleFacilityFeature(facility.ID, models.RequestContentAccess, false))

	resp := NewRequest[models.FacilityFeatureDetail](env.Client, t, http.MethodGet,
		fmt.Sprintf("/api/facilities/%d/features", facility.ID), nil).
		WithTestClaims(deptAdminClaims()).
		Do().
		ExpectStatus(http.StatusOK)

	oc, ok := detailItem(resp.GetData(), models.OpenContentAccess)
	require.True(t, ok)
	require.True(t, oc.Enabled, "parent open_content stays on")

	var requestContent models.FacilityFeatureDetailItem
	var found bool
	for _, pf := range oc.PageFeatures {
		if pf.Feature == models.RequestContentAccess {
			requestContent, found = pf, true
		}
	}
	require.True(t, found, "request_content should be nested under open_content")
	require.True(t, requestContent.GloballyEnabled, "request_content is enabled statewide")
	require.False(t, requestContent.Enabled, "request_content is disabled at this facility")
}

// TestFacilityFeatureInvalidFeature confirms the handler-level ValidFeature guard
// rejects unknown feature keys on both the toggle and the overview filter.
func TestFacilityFeatureInvalidFeature(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()
	seedGlobalFeatureFlags(t, env)

	facility, err := env.CreateTestFacility("Invalid Feature Facility")
	require.NoError(t, err)

	t.Run("toggle rejects an unknown feature", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodPut,
			fmt.Sprintf("/api/facilities/%d/features/not_a_feature", facility.ID),
			map[string]bool{"enabled": true}).
			WithTestClaims(deptAdminClaims()).
			Do().
			ExpectStatus(http.StatusBadRequest).
			ExpectBodyContains("invalid feature")
	})

	t.Run("overview rejects an unknown feature filter", func(t *testing.T) {
		NewRequest[[]models.FacilityFeatureStatus](env.Client, t, http.MethodGet,
			"/api/facilities/features?feature=not_a_feature&enabled=true", nil).
			WithTestClaims(deptAdminClaims()).
			Do().
			ExpectStatus(http.StatusBadRequest).
			ExpectBodyContains("invalid feature")
	})
}

// TestFacilityFeatureFacilityNotFound confirms detail/toggle for a nonexistent
// facility are rejected. Note: the ErrRecordNotFound case maps to 400 (not 404)
// via NewDBError, which is the established convention in this codebase.
func TestFacilityFeatureFacilityNotFound(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()
	seedGlobalFeatureFlags(t, env)

	const missingID = 999999

	t.Run("detail for a missing facility", func(t *testing.T) {
		NewRequest[models.FacilityFeatureDetail](env.Client, t, http.MethodGet,
			fmt.Sprintf("/api/facilities/%d/features", missingID), nil).
			WithTestClaims(deptAdminClaims()).
			Do().
			ExpectStatus(http.StatusBadRequest)
	})

	t.Run("toggle for a missing facility", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodPut,
			fmt.Sprintf("/api/facilities/%d/features/%s", missingID, models.ProgramAccess),
			map[string]bool{"enabled": true}).
			WithTestClaims(deptAdminClaims()).
			Do().
			ExpectStatus(http.StatusBadRequest)
	})
}
