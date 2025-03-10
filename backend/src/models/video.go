package models

import (
	"fmt"
	"time"
)

type Video struct {
	DatabaseFields
	ExternalID            string            `json:"external_id" gorm:"unique"`
	Url                   string            `json:"url" gorm:"unique"`
	Title                 string            `json:"title" gorm:"size:255"`
	Availability          VideoAvailability `json:"availability" gorm:"type:video_availability"`
	ChannelTitle          *string           `json:"channel_title" gorm:"size:255"`
	Duration              int               `json:"duration"`
	Description           string            `json:"description"`
	ThumbnailUrl          string            `json:"thumbnail_url" gorm:"size:255"`
	OpenContentProviderID uint              `json:"open_content_provider_id" gorm:"not null"`
	VisibilityStatus      bool              `gorm:"->" json:"visibility_status"`

	Provider  *OpenContentProvider   `json:"open_content_provider" gorm:"foreignKey:OpenContentProviderID"`
	Attempts  []VideoDownloadAttempt `json:"video_download_attempts" gorm:"foreignKey:VideoID"`
	Favorites []OpenContentFavorite  `json:"video_favorites" gorm:"-"`
}

func (video *Video) GetFacilityVisibilityStatus(facilityID uint) FacilityVisibilityStatus {
	return FacilityVisibilityStatus{
		FacilityID:            facilityID,
		OpenContentProviderID: video.OpenContentProviderID,
		VisibilityStatus:      video.VisibilityStatus,
		ContentID:             video.ID,
	}
}

func (vid *Video) GetS3KeyMp4() string {
	return fmt.Sprintf("videos/%s.mp4", vid.ExternalID)
}
func (vid *Video) GetS3KeyJson() string {
	return fmt.Sprintf("videos/%s.json", vid.ExternalID)
}

func (vid *Video) HasRecentAttempt() bool {
	if vid.Attempts == nil {
		return false
	}
	for _, attempt := range vid.Attempts {
		if attempt.CreatedAt.After(time.Now().Add(-10 * time.Minute)) {
			return true
		}
	}
	return false
}

type VideoAvailability string

const (
	MAX_DOWNLOAD_ATTEMPTS                   = 5
	VideoAvailable        VideoAvailability = "available"
	VideoProcessing       VideoAvailability = "processing"
	VideoHasError         VideoAvailability = "has_error"
)

func (Video) TableName() string { return "videos" }

type VideoDownloadAttempt struct {
	DatabaseFields
	VideoID      uint   `json:"video_id" gorm:"not null"`
	ErrorMessage string `json:"error_message" gorm:"size:512"`

	Video *Video `json:"video" gorm:"foreignKey:VideoID"`
}

func (VideoDownloadAttempt) TableName() string { return "video_download_attempts" }
