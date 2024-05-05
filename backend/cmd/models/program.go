package models

type Program struct {
	DatabaseFields
	ProviderPlatformID uint   `gorm:"not null" json:"provider_platform_id"`
	Name               string `gorm:"size:60" json:"name"`
	Description        string `gorm:"size:510" json:"description"`
	ExternalID         string `gorm:"size:255" json:"external_id"` // kolibri: root, canvas: course_id
	ThumbnailURL       string `gorm:"size:255" json:"thumbnail_url"`
	IsPublic           bool   `gorm:"default:false" json:"is_public"`

	ProviderPlatform ProviderPlatform `gorm:"foreignKey:ProviderPlatformID" json:"-"`
	Milestones       []Milestone      `json:"-"`
	Outcomes         []Outcome        `json:"-"`
}

func (Program) TableName() string {
	return "programs"
}
