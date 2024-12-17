package models

import (
	"time"

	"gorm.io/gorm"
)

type ActivityType string

const (
	CourseInteraction  ActivityType = "interaction" // watching video, clicking link, etc
	ContentInteraction ActivityType = "completion"  // completing submodule, video, etc
)

type Activity struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	CourseID  uint           `gorm:"not null" json:"course_id"`
	UserID    uint           `gorm:"not null" json:"user_id"`
	Type      ActivityType   `gorm:"size:255;not null" json:"type"`
	TotalTime int64          `json:"total_time"`
	TimeDelta int64          `json:"time_delta"`

	// is this a url perhaps?
	ExternalID string `gorm:"size:255;not null" json:"external_content_id"`

	User   *User   `gorm:"foreignKey:UserID" json:"-"`
	Course *Course `gorm:"foreignKey:CourseID" json:"-"`
}

func (Activity) TableName() string {
	return "activities"
}

type UserCourseActivityTotals struct {
	UserID    uint       `gorm:"primaryKey" json:"user_id"`
	CourseID  uint       `gorm:"primaryKey" json:"course_id"`
	TotalTime int64      `json:"total_time"`
	LastTS    *time.Time `json:"last_ts"`
}

func (UserCourseActivityTotals) TableName() string {
	return "user_course_activity_totals"
}

type ImportActivity struct {
	ExternalUserID   string `json:"external_user_id"`
	ExternalCourseID string `json:"external_course_id"`
	Type             string `json:"type"`
	TotalTime        int    `json:"total_time"`
	Date             string `json:"date"`
}

type DailyActivity struct {
	Date       time.Time  `json:"date"`
	TotalTime  uint       `json:"total_time"`
	Quartile   uint       `json:"quartile"`
	Activities []Activity `json:"activities"`
}
