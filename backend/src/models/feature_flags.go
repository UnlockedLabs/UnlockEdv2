package models

import "slices"

type (
	FeatureAccess string

	FeatureFlags struct {
		DatabaseFields
		Name         FeatureAccess      `json:"name" gorm:"not null;type:feature"`
		Enabled      bool               `json:"enabled" gorm:"not null"`
		PageFeatures []PageFeatureFlags `gorm:"foreignKey:FeatureFlagID"`
	}

	PageFeatureFlags struct {
		DatabaseFields
		FeatureFlagID uint          `json:"feature_flag_id" gorm:"not null;index"`
		PageFeature   FeatureAccess `json:"page_feature" gorm:"not null;type:feature"`
		Enabled       bool          `json:"enabled" gorm:"not null"`
	}
)

const (
	OpenContentAccess FeatureAccess = "open_content"
	ProviderAccess    FeatureAccess = "provider_platforms"
	ProgramAccess     FeatureAccess = "program_management"

	// these are the page level features
	RequestContentAccess FeatureAccess = "request_content"
	HelpfulLinksAccess   FeatureAccess = "helpful_links"
	UploadVideoAccess    FeatureAccess = "upload_video"
)

var AllFeatures = []FeatureAccess{OpenContentAccess, ProviderAccess, ProgramAccess, RequestContentAccess, HelpfulLinksAccess, UploadVideoAccess}

func Feature(kinds ...FeatureAccess) []FeatureAccess {
	return kinds
}
func ValidFeature(feature FeatureAccess) bool {
	return slices.Contains(AllFeatures, feature)
}
func (FeatureFlags) TableName() string { return "feature_flags" }

func (PageFeatureFlags) TableName() string { return "page_feature_flags" }
