package models

import "gorm.io/gorm"

type UserActivity struct {
	ID          int            `gorm:"primaryKey" json:"id"`
	UserID      int            `gorm:"not null" json:"user_id"`
	BrowserName string         `gorm:"size 255;default:unknown" json:"browser_name"`
	Platform    string         `gorm:"size 255;default:unknown" json:"platform"`
	Device      string         `gorm:"size 255;default:unknown" json:"device"`
	Ip          string         `gorm:"size 255;default:unknown" json:"ip"`
	ClickedUrl  string         `gorm:"size 255;default:unknown" json:"clicked_url"`
	User        User           `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (ua UserActivity) TableName() string {
	return "user_activities"
}
