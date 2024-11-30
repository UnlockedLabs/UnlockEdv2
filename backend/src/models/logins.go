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
