package models

import (
	"slices"
	"time"

	"gorm.io/gorm"
)

type (
	FeatureAccess string

	FeatureFlags struct {
		DatabaseFields
		Name FeatureAccess `json:"name" gorm:"not null;type:feature"`
		// IsPageFeature marks a shadow row copied from page_feature_flags, so every
		// feature (top-level or sub) has one real id for facility_feature_flags to
		// reference. GetFeatureAccess() excludes these to avoid double-counting.
		IsPageFeature bool               `json:"-" gorm:"not null;default:false"`
		PageFeatures  []PageFeatureFlags `gorm:"foreignKey:FeatureFlagID"`
	}

	PageFeatureFlags struct {
		DatabaseFields
		FeatureFlagID uint          `json:"feature_flag_id" gorm:"not null;index"`
		PageFeature   FeatureAccess `json:"page_feature" gorm:"not null;type:feature"`
		Enabled       bool          `json:"enabled" gorm:"not null"`
	}

	// FacilityFeatureFlag is a per-facility override of a statewide feature default.
	// An absent row means the facility inherits the statewide default; presence of a
	// row (either value) means the facility has been explicitly set.
	FacilityFeatureFlag struct {
		FacilityID    uint      `json:"facility_id" gorm:"primaryKey"`
		FeatureFlagID uint      `json:"feature_flag_id" gorm:"primaryKey"`
		Enabled       bool      `json:"enabled" gorm:"not null"`
		CreateUserID  *uint     `json:"create_user_id,omitempty"`
		UpdateUserID  *uint     `json:"update_user_id,omitempty"`
		CreatedAt     time.Time `json:"created_at"`
		UpdatedAt     time.Time `json:"updated_at"`
	}
)

const (
	OpenContentAccess    FeatureAccess = "open_content"
	ProviderAccess       FeatureAccess = "provider_platforms"
	ProgramAccess        FeatureAccess = "program_management"
	LearningRecordAccess FeatureAccess = "learning_record"
	AiTutorAccess        FeatureAccess = "ai_tutor"

	// these are the page/sub level features
	RequestContentAccess   FeatureAccess = "request_content"
	HelpfulLinksAccess     FeatureAccess = "helpful_links"
	UploadVideoAccess      FeatureAccess = "upload_video"
	ResidentProgramsAccess FeatureAccess = "resident_programs"
)

var AllFeatures = []FeatureAccess{OpenContentAccess, ProviderAccess, ProgramAccess, LearningRecordAccess, AiTutorAccess, RequestContentAccess, HelpfulLinksAccess, UploadVideoAccess, ResidentProgramsAccess}

// TopLevelFeatures are the features shown as their own card/pill on the Feature Control
// page. Page-level (sub-)features are nested under their parent below.
var TopLevelFeatures = []FeatureAccess{OpenContentAccess, ProviderAccess, ProgramAccess, LearningRecordAccess, AiTutorAccess}

// SubFeatureParent maps a page-level feature to the top-level feature that gates it:
// a sub-feature can never be enabled at a facility where its parent is disabled.
var SubFeatureParent = map[FeatureAccess]FeatureAccess{
	RequestContentAccess:   OpenContentAccess,
	HelpfulLinksAccess:     OpenContentAccess,
	UploadVideoAccess:      OpenContentAccess,
	ResidentProgramsAccess: ProgramAccess,
}

// DefaultEnabled is the statewide default for each top-level feature, replacing the
// dropped feature_flags.enabled column (nothing ever edited it after the initial seed).
// Sub-feature defaults are unaffected -- they still come from page_feature_flags.enabled.
var DefaultEnabled = map[FeatureAccess]bool{
	OpenContentAccess:    true,
	ProviderAccess:       true,
	ProgramAccess:        true,
	LearningRecordAccess: false,
	AiTutorAccess:        false,
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

// BeforeCreate sets CreateUserID from context. FacilityFeatureFlag doesn't embed
// DatabaseFields (its primary key is the composite facility_id/feature_flag_id pair), so
// it needs its own copy of DatabaseFields.BeforeCreate's behavior.
func (f *FacilityFeatureFlag) BeforeCreate(tx *gorm.DB) error {
	if userID, ok := tx.Statement.Context.Value(UserIDKey).(uint); ok {
		f.CreateUserID = &userID
	}
	return nil
}
