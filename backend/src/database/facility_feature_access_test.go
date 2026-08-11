package database

import (
	"UnlockEdv2/src/models"
	"testing"

	"github.com/stretchr/testify/assert"
)

// A facility override is authoritative in both directions; the statewide default
// applies only where the facility has no row.
func TestResolveFeatures_OverrideWinsOverStatewide(t *testing.T) {
	// learning_record is off statewide (migration 00069 seeds it disabled).
	statewide := []models.FeatureAccess{models.OpenContentAccess, models.ProgramAccess}

	tests := []struct {
		name      string
		overrides map[models.FeatureAccess]bool
		feature   models.FeatureAccess
		want      bool
	}{
		{
			name:      "override enables a statewide-disabled feature",
			overrides: map[models.FeatureAccess]bool{models.LearningRecordAccess: true},
			feature:   models.LearningRecordAccess,
			want:      true,
		},
		{
			name:      "override disables a statewide-enabled feature",
			overrides: map[models.FeatureAccess]bool{models.OpenContentAccess: false},
			feature:   models.OpenContentAccess,
			want:      false,
		},
		{
			name:      "no override inherits statewide on",
			overrides: nil,
			feature:   models.ProgramAccess,
			want:      true,
		},
		{
			name:      "no override inherits statewide off",
			overrides: nil,
			feature:   models.LearningRecordAccess,
			want:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			states := resolveFeatures(statewide, tt.overrides)
			assert.Equal(t, tt.want, states[tt.feature])
		})
	}
}

// Every known feature gets an entry, so callers can distinguish "off" from
// "absent from the statewide list".
func TestResolveFeatures_CoversAllFeatures(t *testing.T) {
	states := resolveFeatures([]models.FeatureAccess{models.OpenContentAccess}, nil)
	for _, f := range models.AllFeatures {
		_, ok := states[f]
		assert.True(t, ok, "expected an entry for %s", f)
	}
}
