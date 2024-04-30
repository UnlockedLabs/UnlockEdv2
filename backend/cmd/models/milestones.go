package models

import (
	"time"

	"gorm.io/gorm"
)

type MilestoneType string

const (
	Interaction   MilestoneType = "interaction"
	Engagement    MilestoneType = "engagement"
	Participation MilestoneType = "participation"
)

type Milestone struct {
	ID          int            `gorm:"primaryKey" json:"id"`
	ProgramID   int            `gorm:"not null" json:"program_id"`
	Type        MilestoneType  `gorm:"size:255;not null" json:"type"`
	IsCompleted bool           `gorm:"default:false" json:"is_completed"`
	CreatedAt   time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"created_at"`
	UpdatedAt   time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	Program Program `gorm:"foreignKey:ProgramID" json:"_"`
}

func (Milestone) TableName() string {
	return "milestones"
}

func (ms *Milestone) UpdateUserEngagement() {
	if ms.Type == Interaction {
		ms.Type = Engagement
	}
}
