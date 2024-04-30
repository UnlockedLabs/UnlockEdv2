package models

import (
	"time"

	"gorm.io/gorm"
)

type Program struct {
	ID                 int            `gorm:"primaryKey" json:"id"`
	ProviderPlatformID int            `gorm:"not null" json:"provider_platform_id"`
	Name               string         `gorm:"size:60" json:"name"`
	Description        string         `gorm:"size:510" json:"description"`
	ExternalID         string         `gorm:"size:255" json:"external_id"` // kolibri: root, canvas: course_id
	ThumbnailURL       string         `gorm:"size:255" json:"thumbnail_url"`
	IsPublic           bool           `gorm:"default:false" json:"is_public"`
	CreatedAt          time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"created_at"`
	UpdatedAt          time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`

	// foreign key
	ProviderPlatform ProviderPlatform `gorm:"foreignKey:ProviderPlatformID" json:"_"`
}

func (Program) TableName() string {
	return "programs"
}
