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
	if err := hl.DatabaseFields.BeforeCreate(tx); err != nil {
		return err
	}
	hl.UpdateUserID = nil

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

type FacilityHealthSummary struct {
	FacilityID         uint   `json:"facility_id" gorm:"column:facility_id"`
	FacilityName       string `json:"facility_name" gorm:"column:facility_name"`
	Programs           int64  `json:"programs" gorm:"column:programs"`
	ActiveClasses      int64  `json:"active_classes" gorm:"column:active_classes"`
	Enrollment         int64  `json:"enrollment" gorm:"column:enrollment"`
	MissingAttendance  int64  `json:"missing_attendance" gorm:"column:missing_attendance"`
	AttendanceConcerns int64  `json:"attendance_concerns" gorm:"column:attendance_concerns"`
}

type ClassDashboardMetrics struct {
	ActiveClasses      int64 `json:"active_classes"`
	ScheduledClasses   int64 `json:"scheduled_classes"`
	TotalEnrollments   int64 `json:"total_enrollments"`
	TotalSeats         int64 `json:"total_seats"`
	AttendanceConcerns int64 `json:"attendance_concerns"`
}
