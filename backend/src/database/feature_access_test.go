package database

import (
	"UnlockEdv2/src/models"
	"slices"
	"testing"
)

// The statewide/facility split is subtle enough that it produced a real bug:
// a sub-feature whose parent is off STATEWIDE but on for a FACILITY must still
// be inheritable, because effectiveness is decided later by the cascade in
// GetFacilityFeatureAccess. These pin that division of labour.
func TestStatewideDefaults(t *testing.T) {
	aiTutorOff := models.FeatureFlags{
		Name:    models.AiTutorAccess,
		Enabled: false,
		PageFeatures: []models.PageFeatureFlags{
			{PageFeature: models.HiSetTutorAccess, Enabled: true},
			{PageFeature: models.CurriculumBuilderAccess, Enabled: false},
		},
	}
	openContentOn := models.FeatureFlags{
		Name:    models.OpenContentAccess,
		Enabled: true,
		PageFeatures: []models.PageFeatureFlags{
			{PageFeature: models.HelpfulLinksAccess, Enabled: true},
			{PageFeature: models.UploadVideoAccess, Enabled: false},
		},
	}

	defaults := statewideDefaults([]models.FeatureFlags{aiTutorOff, openContentOn})

	t.Run("omits a disabled top-level feature", func(t *testing.T) {
		if slices.Contains(defaults, models.AiTutorAccess) {
			t.Error("ai_tutor is disabled statewide and must not be a default")
		}
	})

	// The regression. Without this, a facility that enables ai_tutor gets the
	// parent and neither capability, because the sub-features were never in the
	// defaults and have no override row of their own.
	t.Run("keeps an enabled sub-feature whose parent is off statewide", func(t *testing.T) {
		if !slices.Contains(defaults, models.HiSetTutorAccess) {
			t.Error("hiset_tutor is enabled and must be inheritable by a facility that turns ai_tutor on")
		}
	})

	t.Run("still omits a sub-feature that is itself disabled", func(t *testing.T) {
		if slices.Contains(defaults, models.CurriculumBuilderAccess) {
			t.Error("curriculum_builder is disabled statewide and must not be a default")
		}
		if slices.Contains(defaults, models.UploadVideoAccess) {
			t.Error("upload_video is disabled statewide and must not be a default")
		}
	})

	t.Run("is unchanged for the older flags, whose parents are enabled", func(t *testing.T) {
		if !slices.Contains(defaults, models.OpenContentAccess) {
			t.Error("open_content is enabled and must be a default")
		}
		if !slices.Contains(defaults, models.HelpfulLinksAccess) {
			t.Error("helpful_links is enabled under an enabled parent and must be a default")
		}
	})
}

// The cascade is the other half: a default that says "on" must still be dropped
// where the facility's parent is off. resolveFeatures is pre-cascade, so it
// reports the raw state and GetFacilityFeatureAccess does the filtering.
func TestResolveFeaturesPrefersOverrides(t *testing.T) {
	defaults := []models.FeatureAccess{models.HiSetTutorAccess}

	t.Run("a facility override wins over the statewide default", func(t *testing.T) {
		states := resolveFeatures(defaults, map[models.FeatureAccess]bool{
			models.HiSetTutorAccess: false,
		})
		if states[models.HiSetTutorAccess] {
			t.Error("an explicit facility 'off' must beat a statewide 'on'")
		}
	})

	t.Run("an absent override inherits the statewide default", func(t *testing.T) {
		states := resolveFeatures(defaults, map[models.FeatureAccess]bool{})
		if !states[models.HiSetTutorAccess] {
			t.Error("a facility with no row must inherit the statewide default")
		}
	})

	t.Run("a facility may enable something that is off statewide", func(t *testing.T) {
		states := resolveFeatures(nil, map[models.FeatureAccess]bool{
			models.AiTutorAccess: true,
		})
		if !states[models.AiTutorAccess] {
			t.Error("an explicit facility 'on' must beat a statewide 'off'")
		}
	})
}
