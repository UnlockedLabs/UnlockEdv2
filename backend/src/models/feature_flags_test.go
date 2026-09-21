package models

import (
	"slices"
	"testing"
)

// The tutor allowlist is the whole boundary on PUT /api/tutor-features/{feature}:
// it is what stops a facility-scoped route from becoming a second, wider Feature
// Control. Table-driven over every known feature so adding one to AllFeatures
// without deciding about it here shows up as a failure.
func TestIsTutorSubFeature(t *testing.T) {
	tests := []struct {
		feature FeatureAccess
		want    bool
	}{
		{HiSetTutorAccess, true},
		{CurriculumBuilderAccess, true},
		{AiTutorAccess, false},
		{OpenContentAccess, false},
		{ProviderAccess, false},
		{ProgramAccess, false},
		{LearningRecordAccess, false},
		{RequestContentAccess, false},
		{HelpfulLinksAccess, false},
		{UploadVideoAccess, false},
		{ResidentProgramsAccess, false},
		{FeatureAccess("not_a_feature"), false},
		{FeatureAccess(""), false},
	}
	for _, tt := range tests {
		t.Run(string(tt.feature), func(t *testing.T) {
			if got := IsTutorSubFeature(tt.feature); got != tt.want {
				t.Errorf("IsTutorSubFeature(%q) = %v, want %v", tt.feature, got, tt.want)
			}
		})
	}
}

// Every tutor sub-feature must be a valid feature, or the route's own allowlist
// would admit a value UpsertFacilityFeatureFlag then rejects.
func TestTutorSubFeaturesAreValid(t *testing.T) {
	for _, feature := range TutorSubFeatures {
		if !ValidFeature(feature) {
			t.Errorf("%q is in TutorSubFeatures but not in AllFeatures", feature)
		}
	}
}

// The parent mapping is what makes ai_tutor a real kill switch for both
// capabilities: UpsertFacilityFeatureFlag refuses to enable a sub-feature whose
// parent is off, and the tutor mirrors the same cascade when it reads the flags.
func TestTutorSubFeaturesCascadeFromAiTutor(t *testing.T) {
	for _, feature := range TutorSubFeatures {
		parent, ok := SubFeatureParent[feature]
		if !ok {
			t.Errorf("%q has no parent, so nothing gates it", feature)
			continue
		}
		if parent != AiTutorAccess {
			t.Errorf("%q is parented to %q, want %q", feature, parent, AiTutorAccess)
		}
	}
}

// Sub-features get nested under their parent's card rather than their own pill.
func TestTutorSubFeaturesAreNotTopLevel(t *testing.T) {
	for _, feature := range TutorSubFeatures {
		if slices.Contains(TopLevelFeatures, feature) {
			t.Errorf("%q is a sub-feature but appears in TopLevelFeatures", feature)
		}
	}
}
