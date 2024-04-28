package models

type Content struct {
	ID                 uint             `gorm:"primaryKey" json:"id"`
	ProviderPlatformID int              `gorm:"not null" json:"provider_platform_id"`
	ProgramID          string           `gorm:"size:255;not null" json:"program_id"`
	Name               string           `gorm:"size:60" json:"name"`
	Description        string           `gorm:"size:255" json:"description"`
	CourseCode         string           `gorm:"size:255" json:"course_code"`
	ImgURL             string           `gorm:"size:255" json:"img_url"`
	IsGraded           bool             `gorm:"default:false" json:"is_graded"`
	IsOpenEnrollment   bool             `gorm:"default:false" json:"is_open_enrollment"`
	IsOpenContent      bool             `gorm:"default:false" json:"is_open_content"`
	HasAssessments     bool             `gorm:"default:false" json:"has_assessments"`
	Subject            string           `gorm:"size:255" json:"subject"`
	ProviderPlatform   ProviderPlatform `gorm:"foreignKey:ProviderPlatformID" json:"_"`
}
