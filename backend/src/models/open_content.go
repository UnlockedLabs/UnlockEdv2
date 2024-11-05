package models

import (
	"fmt"
	"strings"

	"gorm.io/gorm"
)

type OpenContentProvider struct {
	DatabaseFields
	Name             string `gorm:"size:255"  json:"name"`
	BaseUrl          string `gorm:"size:255;not null" json:"base_url"`
	Thumbnail        string `json:"thumbnail_url"`
	CurrentlyEnabled bool   `json:"currently_enabled"`
	Description      string `json:"description"`

	Videos []Video        `gorm:"foreignKey:OpenContentProviderID" json:"-"`
	Tasks  []RunnableTask `gorm:"foreignKey:OpenContentProviderID" json:"-"`
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
	if cp.Name == Youtube && cp.BaseUrl == "" {
		cp.BaseUrl = YoutubeApi
	}
	if cp.BaseUrl != "" && !strings.HasPrefix(cp.BaseUrl, "http") {
		cp.BaseUrl = fmt.Sprintf("https://%s", cp.BaseUrl)
	}
	return nil
}

func (OpenContentProvider) TableName() string { return "open_content_providers" }
