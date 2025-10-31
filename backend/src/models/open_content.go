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
	ID                    int64     `gorm:"primaryKey" json:"id"`
	OpenContentProviderID uint      `gorm:"not null" json:"open_content_provider_id"`
	FacilityID            uint      `gorm:"not null" json:"facility_id"`
	UserID                uint      `gorm:"not null" json:"user_id"`
	ContentID             uint      `gorm:"not null" json:"content_id"`
	OpenContentUrlID      uint      `gorm:"not null" json:"open_content_url_id"`
	RequestTS             time.Time `gorm:"type:datetime;default:CURRENT_TIMESTAMP" json:"request_ts"`
	StopTS                time.Time `gorm:"type:datetime;default:NULL" json:"stop_ts"`

	User                *User                `gorm:"foreignKey:UserID" json:"-"`
	OpenContentProvider *OpenContentProvider `gorm:"foreignKey:OpenContentProviderID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"open_content_provider"`
	Facility            *Facility            `json:"-" gorm:"foreignKey:FacilityID;references:ID"`
}

type OpenContentFavorite struct {
	UserID                uint      `gorm:"not null" json:"user_id"`
	ContentID             uint      `gorm:"not null" json:"content_id"`
	OpenContentProviderID uint      `gorm:"not null" json:"open_content_provider_id"`
	OpenContentUrlID      *uint     `json:"open_content_url_id,omitempty"`
	Name                  string    `json:"name,omitempty"`
	FacilityID            *uint     `json:"facility_id"`
	CreatedAt             time.Time `json:"created_at"`
}

type OpenContentParams struct {
	Name                  string `json:"name"`
	UserID                uint   `json:"user_id"`
	ContentURL            string `json:"content_url"`
	ContentID             uint   `json:"content_id"`
	OpenContentProviderID uint   `json:"open_content_provider_id"`
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
	VisibilityStatus      *bool  `json:"visibility_status"`
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
	YoutubeThumbnail        string = "/youtube.png"
	Youtube                 string = "Youtube"
	YoutubeApi              string = "https://www.googleapis.com/youtube/v3/videos"
	YoutubeDescription      string = "Hand pick videos to be available to students from youtube URL's"
	HelpfulLinks            string = "HelpfulLinks"
	HelpfulLinksThumbnail   string = "/ul-logo-d.svg"
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

// created the below struct for the possibility of adding more feilds to it in the future
type OpenContentAccessCount struct {
	TotalResourcesAccessed int64 `json:"total_resources_accessed"`
}
