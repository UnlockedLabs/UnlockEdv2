package models

type Video struct {
	DatabaseFields
	YoutubeID             *string           `json:"youtube_id" gorm:"unique"`
	Url                   *string           `json:"url" gorm:"unique"`
	Title                 string            `json:"title" gorm:"size:255"`
	Availability          VideoAvailability `json:"availability" gorm:"type:video_availability"`
	ChannelTitle          *string           `json:"channel_title" gorm:"size:255"`
	Description           string            `json:"description"`
	VisibilityStatus      bool              `json:"visibility_status" gorm:"default:true"`
	ThumbnailUrl          string            `json:"thumbnail_url" gorm:"size:255"`
	OpenContentProviderID uint              `json:"open_content_provider_id" gorm:"not null"`

	Provider *OpenContentProvider   `json:"open_content_provider" gorm:"foreignKey:OpenContentProviderID"`
	Attempts []VideoDownloadAttempt `json:"video_download_attempts" gorm:"foreignKey:VideoID"`
}

type VideoAvailability string

const (
	VideoAvailable  VideoAvailability = "available"
	VideoProcessing VideoAvailability = "processing"
	VideoHasError   VideoAvailability = "has_error"
)

func (Video) TableName() string { return "videos" }

type VideoDownloadAttempt struct {
	DatabaseFields
	VideoID uint   `json:"video_id" gorm:"not null"`
	Error   string `json:"error" gorm:"size:512"`

	Video *Video `json:"video" gorm:"foreignKey:VideoID"`
}

func (VideoDownloadAttempt) TableName() string { return "video_download_attempts" }
