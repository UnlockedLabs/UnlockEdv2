package models

import (
	"fmt"
	"strings"

	"gorm.io/gorm"
)

type OpenContentProvider struct {
	DatabaseFields
	Name               string `gorm:"size:255"  json:"name"`
	BaseUrl            string `gorm:"size:255;not null;unique" json:"url"`
	ProviderPlatformID *uint  `json:"provider_platform_id"`
	Thumbnail          string `json:"thumbnail_url"`
	CurrentlyEnabled   bool   `json:"currently_enabled"`
	Description        string `json:"description"`

	ProviderPlatform *ProviderPlatform `gorm:"foreignKey:ProviderPlatformID;constraint:OnDelete SET NULL" json:"-"`
	Tasks            []RunnableTask    `gorm:"foreignKey:OpenContentProviderID" json:"-"`
}

const (
	KolibriThumbnailUrl string = "https://learningequality.org/static/assets/kolibri-ecosystem-logos/blob-logo.svg"
	Kiwix               string = "kiwix"
	KolibriDescription  string = "Kolibri provides an extensive library of educational content suitable for all learning levels."
)

func (cp *OpenContentProvider) BeforeCreate(tx *gorm.DB) error {
	if !strings.HasPrefix(cp.BaseUrl, "http") {
		cp.BaseUrl = fmt.Sprintf("https://%s", cp.BaseUrl)
	}
	return nil
}

func (OpenContentProvider) TableName() string { return "open_content_providers" }
