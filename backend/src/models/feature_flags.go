package models

import (
	"slices"
	"time"
)

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

	// FacilityFeatureFlag is a per-facility override of a statewide feature default.
	// An absent row means the facility inherits the statewide default; presence of a
	// row (either value) means the facility has been explicitly set.
	FacilityFeatureFlag struct {
		FacilityID   uint          `json:"facility_id" gorm:"primaryKey"`
		Feature      FeatureAccess `json:"feature" gorm:"primaryKey;type:feature"`
		Enabled      bool          `json:"enabled" gorm:"not null"`
		UpdateUserID *uint         `json:"update_user_id,omitempty"`
		CreatedAt    time.Time     `json:"created_at"`
		UpdatedAt    time.Time     `json:"updated_at"`
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
	// The two capabilities behind the AI Tutor. ai_tutor itself is now a container:
	// hiset_tutor is the conversational tutor residents use, curriculum_builder is
	// admin-authored coursework residents only read.
	HiSetTutorAccess        FeatureAccess = "hiset_tutor"
	CurriculumBuilderAccess FeatureAccess = "curriculum_builder"
)

var AllFeatures = []FeatureAccess{OpenContentAccess, ProviderAccess, ProgramAccess, LearningRecordAccess, AiTutorAccess, RequestContentAccess, HelpfulLinksAccess, UploadVideoAccess, ResidentProgramsAccess, HiSetTutorAccess, CurriculumBuilderAccess}

// TopLevelFeatures are the features shown as their own card/pill on the Feature Control
// page. Page-level (sub-)features are nested under their parent below.
var TopLevelFeatures = []FeatureAccess{OpenContentAccess, ProviderAccess, ProgramAccess, LearningRecordAccess, AiTutorAccess}

// SubFeatureParent maps a page-level feature to the top-level feature that gates it:
// a sub-feature can never be enabled at a facility where its parent is disabled.
var SubFeatureParent = map[FeatureAccess]FeatureAccess{
	RequestContentAccess:    OpenContentAccess,
	HelpfulLinksAccess:      OpenContentAccess,
	UploadVideoAccess:       OpenContentAccess,
	ResidentProgramsAccess:  ProgramAccess,
	HiSetTutorAccess:        AiTutorAccess,
	CurriculumBuilderAccess: AiTutorAccess,
}

// TutorSubFeatures are the features a facility admin may operate for their own
// facility from the AI Tutor page. Deliberately an allowlist rather than "every
// sub-feature": it is what keeps the facility-scoped route from becoming a second,
// wider Feature Control.
var TutorSubFeatures = []FeatureAccess{HiSetTutorAccess, CurriculumBuilderAccess}

func IsTutorSubFeature(feature FeatureAccess) bool {
	return slices.Contains(TutorSubFeatures, feature)
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
