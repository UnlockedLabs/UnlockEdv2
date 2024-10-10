package models

type Library struct {
	DatabaseFields
	OpenContentProviderID uint    `gorm:"not null" json:"open_content_provider_id"`
	ExternalID            *string `json:"external_id"`
	Name                  string  `gorm:"size:255;not null" json:"name"`
	Language              *string `gorm:"size:255" json:"language"`
	Description           *string `json:"description"`
	Url                   string  `gorm:"not null" json:"url"`
	ImageUrl              *string `json:"image_url"`
	VisibilityStatus      bool    `gorm:"default:false;not null" json:"visibility_status"`

	OpenContentProvider *OpenContentProvider `gorm:"foreignKey:OpenContentProviderID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"open_content_provider"`
}

func (Library) TableName() string { return "libraries" }
