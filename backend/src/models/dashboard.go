package models

import (
	"time"

	"gorm.io/gorm"
)

type HelpfulLink struct {
	DatabaseFields
	Title                 string `gorm:"size:255;not null" json:"title"`
	Description           string `gorm:"size:255;not null" json:"description"`
	Url                   string `gorm:"size:255;not null" json:"url"`
	VisibilityStatus      bool   `gorm:"default:true" json:"visibility_status"`
	OpenContentProviderID uint   `json:"open_content_provider_id"`
	ThumbnailUrl          string `gorm:"size:255;" json:"thumbnail_url"`
	FacilityID            uint   `json:"facility_id"`
}

func (HelpfulLink) TableName() string {
	return "helpful_links"
}

func (hl *HelpfulLink) BeforeCreate(tx *gorm.DB) error {
	var id int
	if hl.OpenContentProviderID == 0 {
		if err := tx.Table("open_content_providers").Select("id").Where("title = ? ", HelpfulLinks).Scan(&id).Error; err != nil {
			return err
		}
		hl.OpenContentProviderID = uint(id)
	}
	return nil
}

type CachedDashboard[T any] struct {
	LastCache time.Time `json:"last_cache"`
	Data      T         `json:"data"`
}
