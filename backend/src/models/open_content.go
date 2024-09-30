package models

import (
	"strings"

	"gorm.io/gorm"
)

type OpenContentProvider struct {
	DatabaseFields
	Name               string            `gorm:"size:255"  json:"name"`
	Url                string            `gorm:"size:255;not null;unique" json:"url"`
	ProviderPlatformID *uint             `json:"provider_platform_id"`
	Thumbnail          string            `json:"thumbnail_url"`
	CurrentlyEnabled   bool              `json:"currently_enabled"`
	Description        string            `json:"description"`
	ProviderPlatform   *ProviderPlatform `gorm:"foreignKey:ProviderPlatformID;constraint:OnDelete SET NULL" json:"-"`
}

const (
	KolibriDescription string = "Kolibri provides an extensive library of educational content suitable for all learning levels."
)

func (cp *OpenContentProvider) BeforeCreate(tx *gorm.DB) error {
	if !strings.HasPrefix(cp.Url, "http") {
		cp.Url = "https://" + cp.Url
	}
	return nil
}

func (OpenContentProvider) TableName() string { return "open_content_providers" }
