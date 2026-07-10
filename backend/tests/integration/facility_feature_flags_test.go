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

// effectiveSet resolves a facility's effective feature set via the DB layer.
func effectiveSet(t *testing.T, env *TestEnv, facilityID uint) []models.FeatureAccess {
	t.Helper()
	features, err := env.DB.GetFacilityFeatureAccess(facilityID)
	require.NoError(t, err)
	return features
}

// applyToAll issues the bulk apply-all request for the given source facility.
func applyToAll(t *testing.T, env *TestEnv, sourceID uint) *Response[any] {
	t.Helper()
	return NewRequest[any](env.Client, t, http.MethodPut, "/api/facilities/features/apply-all",
		map[string]uint{"source_facility_id": sourceID}).
		WithTestClaims(deptAdminClaims()).
		Do()
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

// TestApplyFacilityFeaturesToAll covers the bulk endpoint: the source facility's
// effective settings (a disabled top-level feature and a disabled page feature)
// are copied to every other facility, overwriting each target's prior state,
// while the source itself is left untouched.
func TestApplyFacilityFeaturesToAll(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()
	seedGlobalFeatureFlags(t, env)

	source, err := env.CreateTestFacility("Source Facility")
	require.NoError(t, err)
	targetA, err := env.CreateTestFacility("Target A")
	require.NoError(t, err)
	targetB, err := env.CreateTestFacility("Target B")
	require.NoError(t, err)

	// Source state: program_management off, request_content (a sub-feature) off.
	require.NoError(t, env.DB.ToggleFacilityFeature(source.ID, models.ProgramAccess, false))
	require.NoError(t, env.DB.ToggleFacilityFeature(source.ID, models.RequestContentAccess, false))

	// Target A starts in a conflicting state (open_content disabled) to prove the
	// apply overwrites prior target settings to match the source.
	require.NoError(t, env.DB.ToggleFacilityFeature(targetA.ID, models.OpenContentAccess, false))

	NewRequest[any](env.Client, t, http.MethodPut, "/api/facilities/features/apply-all",
		map[string]uint{"source_facility_id": source.ID}).
		WithTestClaims(deptAdminClaims()).
		Do().
		ExpectStatus(http.StatusOK).
		ExpectMessage("settings applied to all facilities")

	assertMatchesSource := func(facilityID uint) {
		features, err := env.DB.GetFacilityFeatureAccess(facilityID)
		require.NoError(t, err)
		require.NotContains(t, features, models.ProgramAccess, "program_management copied as off")
		require.NotContains(t, features, models.RequestContentAccess, "request_content copied as off")
		require.Contains(t, features, models.OpenContentAccess, "open_content on (parent re-enabled on target A)")
		require.Contains(t, features, models.HelpfulLinksAccess, "sibling sub-feature stays on")
		require.Contains(t, features, models.UploadVideoAccess, "sibling sub-feature stays on")
	}
	assertMatchesSource(targetA.ID)
	assertMatchesSource(targetB.ID)

	// Source is unchanged: still exactly its own overrides.
	sourceFeatures, err := env.DB.GetFacilityFeatureAccess(source.ID)
	require.NoError(t, err)
	require.NotContains(t, sourceFeatures, models.ProgramAccess)
	require.NotContains(t, sourceFeatures, models.RequestContentAccess)
	require.Contains(t, sourceFeatures, models.OpenContentAccess)
}

// TestApplyFacilityFeaturesToAllGuards covers the bulk endpoint's error paths:
// a missing source id, a nonexistent source facility, and RBAC.
func TestApplyFacilityFeaturesToAllGuards(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()
	seedGlobalFeatureFlags(t, env)

	facility, err := env.CreateTestFacility("Apply Guard Facility")
	require.NoError(t, err)

	t.Run("missing source_facility_id is rejected", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodPut, "/api/facilities/features/apply-all",
			map[string]uint{}).
			WithTestClaims(deptAdminClaims()).
			Do().
			ExpectStatus(http.StatusBadRequest).
			ExpectBodyContains("source_facility_id is required")
	})

	t.Run("nonexistent source facility is rejected", func(t *testing.T) {
		// ErrRecordNotFound maps to 400 via NewDBError (codebase convention).
		NewRequest[any](env.Client, t, http.MethodPut, "/api/facilities/features/apply-all",
			map[string]uint{"source_facility_id": 999999}).
			WithTestClaims(deptAdminClaims()).
			Do().
			ExpectStatus(http.StatusBadRequest)
	})

	t.Run("facility admin cannot apply to all", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodPut, "/api/facilities/features/apply-all",
			map[string]uint{"source_facility_id": facility.ID}).
			WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, FacilityID: facility.ID}).
			Do().
			ExpectStatus(http.StatusUnauthorized)
	})
}

// TestApplyFacilityFeaturesToAllInvariant is the core correctness property: after
// apply-all, EVERY facility (created targets AND the pre-existing seeded Default
// facility that the test never touched) resolves to the exact same effective
// feature set as the source, regardless of the target's prior state.
func TestApplyFacilityFeaturesToAllInvariant(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()
	seedGlobalFeatureFlags(t, env)

	source, err := env.CreateTestFacility("Invariant Source")
	require.NoError(t, err)
	// Source: program off, request_content off (a mixed state).
	require.NoError(t, env.DB.ToggleFacilityFeature(source.ID, models.ProgramAccess, false))
	require.NoError(t, env.DB.ToggleFacilityFeature(source.ID, models.RequestContentAccess, false))

	// Targets in varied prior states.
	allOn, err := env.CreateTestFacility("Invariant All On") // no overrides
	require.NoError(t, err)
	conflicting, err := env.CreateTestFacility("Invariant Conflicting")
	require.NoError(t, err)
	require.NoError(t, env.DB.ToggleFacilityFeature(conflicting.ID, models.OpenContentAccess, false))
	require.NoError(t, env.DB.ToggleFacilityFeature(conflicting.ID, models.HelpfulLinksAccess, false))

	applyToAll(t, env, source.ID).
		ExpectStatus(http.StatusOK).
		ExpectMessage("settings applied to all facilities")

	want := effectiveSet(t, env, source.ID)
	require.ElementsMatch(t, want, effectiveSet(t, env, allOn.ID), "all-on target matches source")
	require.ElementsMatch(t, want, effectiveSet(t, env, conflicting.ID), "conflicting target overwritten to match source")

	// The seeded Default facility (never referenced by this test) also matches.
	var def models.Facility
	require.NoError(t, env.DB.Where("name = ?", "Default").First(&def).Error)
	require.ElementsMatch(t, want, effectiveSet(t, env, def.ID), "pre-existing facility is included in 'all'")
}

// TestApplyFacilityFeaturesToAllReenablesFromInheritSource proves apply-all can
// turn features back ON: an all-inherit (all-on) source re-enables features a
// target had previously disabled.
func TestApplyFacilityFeaturesToAllReenablesFromInheritSource(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()
	seedGlobalFeatureFlags(t, env)

	source, err := env.CreateTestFacility("Reenable Source") // no overrides -> everything on
	require.NoError(t, err)

	target, err := env.CreateTestFacility("Reenable Target")
	require.NoError(t, err)
	require.NoError(t, env.DB.ToggleFacilityFeature(target.ID, models.ProgramAccess, false))
	require.NoError(t, env.DB.ToggleFacilityFeature(target.ID, models.UploadVideoAccess, false))

	// Precondition: target is missing the disabled features.
	before := effectiveSet(t, env, target.ID)
	require.NotContains(t, before, models.ProgramAccess)
	require.NotContains(t, before, models.UploadVideoAccess)

	applyToAll(t, env, source.ID).ExpectStatus(http.StatusOK)

	after := effectiveSet(t, env, target.ID)
	require.Contains(t, after, models.ProgramAccess, "program_management re-enabled")
	require.Contains(t, after, models.UploadVideoAccess, "upload_video re-enabled")
	require.ElementsMatch(t, effectiveSet(t, env, source.ID), after)
}

// TestApplyFacilityFeaturesToAllCascadesParentOff proves that copying a source
// whose parent feature is off drives the parent AND all its sub-features off at
// every target, even subs the target had explicitly on.
func TestApplyFacilityFeaturesToAllCascadesParentOff(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()
	seedGlobalFeatureFlags(t, env)

	source, err := env.CreateTestFacility("Cascade Source")
	require.NoError(t, err)
	require.NoError(t, env.DB.ToggleFacilityFeature(source.ID, models.OpenContentAccess, false)) // parent off

	target, err := env.CreateTestFacility("Cascade Target") // all inherit -> KC + subs on
	require.NoError(t, err)

	applyToAll(t, env, source.ID).ExpectStatus(http.StatusOK)

	after := effectiveSet(t, env, target.ID)
	require.NotContains(t, after, models.OpenContentAccess, "parent copied off")
	require.NotContains(t, after, models.RequestContentAccess, "sub dropped with parent")
	require.NotContains(t, after, models.HelpfulLinksAccess, "sub dropped with parent")
	require.NotContains(t, after, models.UploadVideoAccess, "sub dropped with parent")
	require.ElementsMatch(t, effectiveSet(t, env, source.ID), after)
}

// TestApplyFacilityFeaturesToAllIdempotent confirms a second identical apply is a
// no-op: state and effective sets are unchanged and the call still succeeds.
func TestApplyFacilityFeaturesToAllIdempotent(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()
	seedGlobalFeatureFlags(t, env)

	source, err := env.CreateTestFacility("Idempotent Source")
	require.NoError(t, err)
	require.NoError(t, env.DB.ToggleFacilityFeature(source.ID, models.ProgramAccess, false))

	target, err := env.CreateTestFacility("Idempotent Target")
	require.NoError(t, err)

	applyToAll(t, env, source.ID).ExpectStatus(http.StatusOK)
	first := effectiveSet(t, env, target.ID)

	applyToAll(t, env, source.ID).ExpectStatus(http.StatusOK)
	second := effectiveSet(t, env, target.ID)

	require.ElementsMatch(t, first, second, "re-applying the same source changes nothing")
	require.ElementsMatch(t, effectiveSet(t, env, source.ID), second)
}

// TestApplyFacilityFeaturesToAllWritesExpectedRows inspects the persisted override
// rows: apply materializes an explicit row for every globally-enabled manageable
// feature (top-level + page) and skips features that are not manageable
// per-facility (provider_platforms) or globally disabled (learning_record).
func TestApplyFacilityFeaturesToAllWritesExpectedRows(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()
	seedGlobalFeatureFlags(t, env)

	source, err := env.CreateTestFacility("Rows Source") // all inherit -> everything on
	require.NoError(t, err)
	target, err := env.CreateTestFacility("Rows Target") // fresh, no prior rows
	require.NoError(t, err)

	require.NoError(t, env.DB.ApplyFacilityFeaturesToAll(source.ID))

	var rows []models.FacilityFeatureFlag
	require.NoError(t, env.DB.Where("facility_id = ?", target.ID).Find(&rows).Error)

	got := make(map[models.FeatureAccess]bool, len(rows))
	for _, r := range rows {
		got[r.Feature] = r.Enabled
	}
	expected := map[models.FeatureAccess]bool{
		models.OpenContentAccess:    true,
		models.RequestContentAccess: true,
		models.HelpfulLinksAccess:   true,
		models.UploadVideoAccess:    true,
		models.ProgramAccess:        true,
	}
	require.Equal(t, expected, got, "exactly the globally-enabled manageable features are materialized as on")

	// Never write rows for non-manageable / globally-off features.
	_, hasProvider := got[models.ProviderAccess]
	require.False(t, hasProvider, "provider_platforms is not managed per-facility")
	_, hasLearningRecord := got[models.LearningRecordAccess]
	require.False(t, hasLearningRecord, "globally-disabled learning_record is skipped")
}

// TestApplyFacilityFeaturesToAllRecordsAuditUser confirms the acting admin's user
// id propagates through the bulk transaction onto the materialized override rows
// (the audit trail the storage model was designed to preserve).
func TestApplyFacilityFeaturesToAllRecordsAuditUser(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()
	seedGlobalFeatureFlags(t, env)

	source, err := env.CreateTestFacility("Audit Source")
	require.NoError(t, err)
	target, err := env.CreateTestFacility("Audit Target")
	require.NoError(t, err)

	const actingUserID = uint(4242)
	NewRequest[any](env.Client, t, http.MethodPut, "/api/facilities/features/apply-all",
		map[string]uint{"source_facility_id": source.ID}).
		WithTestClaims(&handlers.Claims{Role: models.DepartmentAdmin, UserID: actingUserID}).
		Do().
		ExpectStatus(http.StatusOK)

	var rows []models.FacilityFeatureFlag
	require.NoError(t, env.DB.Where("facility_id = ?", target.ID).Find(&rows).Error)
	require.NotEmpty(t, rows, "apply materializes rows on the target")
	for _, r := range rows {
		require.NotNil(t, r.CreateUserID, "create_user_id set inside the transaction for %s", r.Feature)
		require.Equal(t, actingUserID, *r.CreateUserID, "audit user propagated for %s", r.Feature)
	}
}
