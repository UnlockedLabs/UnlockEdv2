package models

import (
	"time"

	"gorm.io/gorm"
)

type ActivityType string

const (
	ProgramInteraction ActivityType = "interaction" // watching video, clicking link, etc
	ContentInteraction ActivityType = "completion"  // completing submodule, video, etc
)

type Activity struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	ProgramID uint           `gorm:"not null" json:"program_id"`
	UserID    uint           `gorm:"not null" json:"user_id"`
	Type      ActivityType   `gorm:"size:255;not null" json:"type"`
	TotalTime uint           `json:"total_time"`
	TimeDelta uint           `json:"time_delta"`

	// is this a url perhaps?
	ExternalID string `gorm:"size:255;not null" json:"external_content_id"`

	User    *User    `gorm:"foreignKey:UserID" json:"-"`
	Program *Program `gorm:"foreignKey:ProgramID" json:"-"`
}

func (Activity) TableName() string {
	return "activities"
}

type ImportActivity struct {
	ExternalUserID    string `json:"external_user_id"`
	ExternalProgramID string `json:"external_program_id"`
	Type              string `json:"type"`
	TotalTime         int    `json:"total_time"`
	Date              string `json:"date"`
}

type DailyActivity struct {
    Date        time.Time
    TotalTime   uint
	Quartile  	uint
    Activities  []Activity
}
