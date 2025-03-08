package models

import "time"

type LoginMetrics struct {
	UserID    uint      `json:"user_id" gorm:"primaryKey"`
	Total     int64     `json:"total" gorm:"default:1"`
	LastLogin time.Time `json:"last_login" gorm:"default:CURRENT_TIMESTAMP"`

	User *User `json:"user,omitempty" gorm:"foreignKey:UserID;constraint:OnDelete CASCADE"`
}

func (LoginMetrics) TableName() string { return "login_metrics" }

type LoginActivity struct {
	TimeInterval time.Time `json:"time_interval" gorm:"primaryKey"`
	FacilityID   uint      `json:"facility_id" gorm:"primaryKey"`
	TotalLogins  int64     `json:"total_logins" gorm:"default:1"`

	Facility *Facility `json:"facility,omitempty" gorm:"foreignKey:FacilityID;constraint:OnDelete CASCADE"`
}

func (LoginActivity) TableName() string { return "login_activity" }

type UserSessionTracking struct {
	ID              int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID          uint      `gorm:"not null" json:"user_id"`
	SessionID       string    `gorm:"size:255;not null" json:"session_id"`
	SessionStartTS  time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"session_start_ts"`
	SessionEndTS    time.Time `gorm:"default:NULL" json:"session_end_ts"`
	SessionDuration string    `gorm:"->;type:interval;generated always as (session_end_ts - session_start_ts) stored" json:"-"`

	User *User `json:"user,omitempty" gorm:"foreignKey:UserID;constraint:OnDelete CASCADE"`
}

func (UserSessionTracking) TableName() string { return "user_session_tracking" }

type SessionEngagement struct {
	UserId       int64   `json:"user_id"`
	TimeInterval string  `json:"time_interval"`
	TotalMinutes float64 `json:"total_minutes"`
	TotalHours   float64 `json:"total_hours"`
}

type EngagementActivityMetrics struct {
	UserID                   int64      `json:"user_id"`
	TotalActiveDaysMonthly   int64      `json:"total_active_days_monthly"`
	TotalHoursActiveMonthly  float64    `json:"total_hours_active_monthly"`
	TotalHoursActiveWeekly   float64    `json:"total_hours_active_weekly"`
	TotalMinutesActiveWeekly float64    `json:"total_minutes_active_weekly"`
	TotalHoursEngaged        float64    `json:"total_hours_engaged"`
	TotalMinutesEngaged      float64    `json:"total_minutes_engaged"`
	Joined                   time.Time  `json:"joined"`
	LastActiveDate           *time.Time `json:"last_active_date"`
}
