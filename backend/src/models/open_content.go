package models

import (
	"fmt"
	"strings"

	"gorm.io/gorm"
)

type OpenContentProvider struct {
	DatabaseFields
	Name               string  `gorm:"size:255"  json:"name"`
	BaseUrl            string  `gorm:"size:255;not null;unique" json:"url"`
	ProviderPlatformID *uint   `json:"provider_platform_id"`
	Thumbnail          string  `json:"thumbnail_url"`
	CurrentlyEnabled   bool    `json:"currently_enabled"`
	Description        string  `json:"description"`
	ApiKey             *string `json:"api_key"`

	ProviderPlatform *ProviderPlatform `gorm:"foreignKey:ProviderPlatformID;constraint:OnDelete SET NULL" json:"-"`
	Videos           []Video           `gorm:"foreignKey:OpenContentProviderID" json:"-"`
	Tasks            []RunnableTask    `gorm:"foreignKey:OpenContentProviderID" json:"-"`
}

const (
	KolibriThumbnailUrl string = "https://learningequality.org/static/assets/kolibri-ecosystem-logos/blob-logo.svg"
	Kiwix               string = "Kiwix"
	KolibriDescription  string = "Kolibri provides an extensive library of educational content suitable for all learning levels."
	KiwixThumbnailURL   string = "/kiwix.jpg"
	KiwixDescription    string = "Kiwix is an offline reader that allows you to host a wide array of educational content."
	KiwixLibraryUrl     string = "https://library.kiwix.org"
	YoutubeThumbnail    string = "/youtube.png"
	Youtube             string = "Youtube"
	YoutubeApi          string = "https://www.googleapis.com/youtube/v3/videos"
	YoutubeDescription  string = "Hand pick videos to be available to students from youtube URL's"
)

func (cp *OpenContentProvider) BeforeCreate(tx *gorm.DB) error {
	if !strings.HasPrefix(cp.BaseUrl, "http") {
		cp.BaseUrl = fmt.Sprintf("https://%s", cp.BaseUrl)
	}
	if cp.ApiKey != nil {
		encryptedKey, err := EncryptAccessKey(*cp.ApiKey)
		if err != nil {
			return err
		}
		cp.ApiKey = &encryptedKey
	}
	if cp.Name == Youtube && cp.BaseUrl == "" {
		cp.BaseUrl = YoutubeApi
	}
	return nil
}

func (OpenContentProvider) TableName() string { return "open_content_providers" }
