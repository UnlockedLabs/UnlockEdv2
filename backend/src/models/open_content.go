package models

import (
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

type OpenContentProvider struct {
	DatabaseFields
	Title            string `gorm:"size:255"  json:"title"`
	Url              string `gorm:"size:255;not null" json:"url"`
	ThumbnailUrl     string `json:"thumbnail_url"`
	CurrentlyEnabled bool   `json:"currently_enabled"`
	Description      string `json:"description"`

	Videos []Video        `gorm:"foreignKey:OpenContentProviderID" json:"-"`
	Tasks  []RunnableTask `gorm:"foreignKey:OpenContentProviderID" json:"-"`
}

type OpenContentActivity struct {
	OpenContentProviderID uint      `gorm:"not null" json:"open_content_provider_id"`
	FacilityID            uint      `gorm:"not null" json:"facility_id"`
	UserID                uint      `gorm:"not null" json:"user_id"`
	ContentID             uint      `gorm:"not null" json:"content_id"`
	OpenContentUrlID      uint      `gorm:"not null" json:"open_content_url_id"`
	RequestTS             time.Time `gorm:"type:timestamp(0);default:CURRENT_TIMESTAMP" json:"request_ts"`

	User                *User                `gorm:"foreignKey:UserID" json:"-"`
	OpenContentProvider *OpenContentProvider `gorm:"foreignKey:OpenContentProviderID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"open_content_provider"`
	Facility            *Facility            `json:"-" gorm:"foreignKey:FacilityID;references:ID"`
}

type OpenContentFavorite struct {
	UserID                uint      `gorm:"not null" json:"user_id"`
	ContentID             uint      `gorm:"not null" json:"content_id"`
	OpenContentProviderID uint      `gorm:"not null" json:"open_content_provider_id"`
	FacilityID            *uint     `json:"facility_id"`
	CreatedAt             time.Time `json:"created_at"`
}

func (OpenContentActivity) TableName() string { return "open_content_activities" }

type OpenContentUrl struct {
	ID         uint   `gorm:"primaryKey" json:"-"`
	ContentURL string `gorm:"size:255" json:"content_url"`
}

func (OpenContentUrl) TableName() string { return "open_content_urls" }

type OpenContentItem struct {
	Title                 string `json:"title"`
	Url                   string `json:"url"`
	ThumbnailUrl          string `json:"thumbnail_url"`
	Description           string `json:"description,omitempty"`
	VisibilityStatus      bool   `json:"visibility_status,omitempty"`
	OpenContentProviderId uint   `json:"open_content_provider_id"`
	ContentId             uint   `json:"content_id"`
	ContentType           string `json:"content_type"`
	ProviderName          string `json:"provider_name,omitempty"`
	ChannelTitle          string `json:"channel_title,omitempty"`
}

const (
	KolibriThumbnailUrl     string = "https://learningequality.org/static/assets/kolibri-ecosystem-logos/blob-logo.svg"
	Kiwix                   string = "Kiwix"
	KolibriDescription      string = "Kolibri provides an extensive library of educational content suitable for all learning levels."
	KiwixThumbnailURL       string = "/kiwix.jpg"
	KiwixDescription        string = "Kiwix is an offline reader that allows you to host a wide array of educational content."
	KiwixLibraryUrl         string = "https://library.kiwix.org"
	YoutubeThumbnail        string = "/youtube.png"
	Youtube                 string = "Youtube"
	YoutubeApi              string = "https://www.googleapis.com/youtube/v3/videos"
	YoutubeDescription      string = "Hand pick videos to be available to students from youtube URL's"
	HelpfulLinks            string = "HelpfulLinks"
	HelpfulLinksThumbnail   string = "/ul-logo.png"
	HelpfulLinksUrl         string = ""
	HelpfulLinksDescription string = "Hand picked helpful links for users"
)

func (cp *OpenContentProvider) BeforeCreate(tx *gorm.DB) error {
	if cp.Title == Youtube && cp.Url == "" {
		cp.Url = YoutubeApi
	}
	if cp.Url != "" && !strings.HasPrefix(cp.Url, "http") {
		cp.Url = fmt.Sprintf("https://%s", cp.Url)
	}
	return nil
}

func (OpenContentProvider) TableName() string { return "open_content_providers" }
