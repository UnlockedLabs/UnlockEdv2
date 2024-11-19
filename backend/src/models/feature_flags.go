package models

import "slices"

type (
	FeatureAccess string

	FeatureFlags struct {
		DatabaseFields
		Name    FeatureAccess `json:"name" gorm:"not null;type:feature"`
		Enabled bool          `json:"enabled" gorm:"not null"`
	}
)

const (
	OpenContentAccess FeatureAccess = "open_content"
	ProviderAccess    FeatureAccess = "provider_platforms"
	ProgramAccess     FeatureAccess = "program_management"
)

var AllFeatures = []FeatureAccess{OpenContentAccess, ProviderAccess, ProgramAccess}

func Feature(kinds ...FeatureAccess) []FeatureAccess {
	return kinds
}
func ValidFeature(feature FeatureAccess) bool {
	return slices.Contains(AllFeatures, feature)
}
func (FeatureFlags) TableName() string { return "feature_flags" }
