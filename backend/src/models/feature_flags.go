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

	// FacilityFeatureFlag is a per-facility override of a global feature flag.
	// The absence of a row means the facility inherits the global value; a row
	// with enabled=false disables the feature for that facility even when it is
	// globally enabled. Note: no gorm "default" tag on Enabled — that would make
	// GORM omit zero-value (false) inserts and the DB default (true) would win,
	// making it impossible to disable a feature.
	FacilityFeatureFlag struct {
		DatabaseFields
		FacilityID uint          `json:"facility_id" gorm:"not null;index"`
		Feature    FeatureAccess `json:"feature" gorm:"not null;type:feature"`
		Enabled    bool          `json:"enabled" gorm:"not null"`
		Facility   *Facility     `json:"-" gorm:"foreignKey:FacilityID;references:ID"`
	}
)

const (
	OpenContentAccess    FeatureAccess = "open_content"
	ProviderAccess       FeatureAccess = "provider_platforms"
	ProgramAccess        FeatureAccess = "program_management"
	LearningRecordAccess FeatureAccess = "learning_record"

	// these are the page level features
	RequestContentAccess FeatureAccess = "request_content"
	HelpfulLinksAccess   FeatureAccess = "helpful_links"
	UploadVideoAccess    FeatureAccess = "upload_video"
)

var AllFeatures = []FeatureAccess{OpenContentAccess, ProviderAccess, ProgramAccess, LearningRecordAccess, RequestContentAccess, HelpfulLinksAccess, UploadVideoAccess}

// TopLevelFacilityFeatures are the top-level features a department admin can
// manage per facility, in display order. Mirrors the cards on the global
// Feature Control page. ProviderAccess (provider_platforms) is intentionally
// excluded — it is configured per provider platform, not per facility.
var TopLevelFacilityFeatures = []FeatureAccess{OpenContentAccess, LearningRecordAccess, ProgramAccess}

// FacilityFeatureStatus is one row of the per-facility feature overview list:
// a facility plus the effective on/off state of each manageable, globally
// enabled top-level feature, with a rolled-up "enabled of total" count.
type FacilityFeatureStatus struct {
	FacilityID   uint                  `json:"facility_id"`
	FacilityName string                `json:"facility_name"`
	Features     []FeatureToggleStatus `json:"features"`
	EnabledCount int                   `json:"enabled_count"`
	TotalCount   int                   `json:"total_count"`
}

// FeatureToggleStatus is the effective state of a single feature (global AND facility).
type FeatureToggleStatus struct {
	Feature FeatureAccess `json:"feature"`
	Enabled bool          `json:"enabled"`
}

// FacilityFeatureDetail is the right-panel payload for a single facility: each
// manageable top-level feature (with its page sub-features nested underneath).
type FacilityFeatureDetail struct {
	FacilityID   uint                        `json:"facility_id"`
	FacilityName string                      `json:"facility_name"`
	Features     []FacilityFeatureDetailItem `json:"features"`
}

// FacilityFeatureDetailItem is one feature toggle in the detail panel.
//   - Enabled: this toggle's own effective state (global master on AND not
//     disabled at the facility). Page features report their own state; parent
//     gating (grey out when the parent is off) is a display concern handled by
//     the client, matching FeatureControl.tsx's SubFeatureRow.
//   - GloballyEnabled: whether the global master switch is on — lets the client
//     grey a toggle the system admin has turned off statewide.
type FacilityFeatureDetailItem struct {
	Feature         FeatureAccess               `json:"feature"`
	Enabled         bool                        `json:"enabled"`
	GloballyEnabled bool                        `json:"globally_enabled"`
	PageFeatures    []FacilityFeatureDetailItem `json:"page_features,omitempty"`
}

func Feature(kinds ...FeatureAccess) []FeatureAccess {
	return kinds
}
func ValidFeature(feature FeatureAccess) bool {
	return slices.Contains(AllFeatures, feature)
}
func (FeatureFlags) TableName() string { return "feature_flags" }

func (PageFeatureFlags) TableName() string { return "page_feature_flags" }

func (FacilityFeatureFlag) TableName() string { return "facility_feature_flags" }
