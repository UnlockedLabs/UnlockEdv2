package models

type Outcome struct {
	DatabaseFields
	Type        OutcomeType `gorm:"size:255;not null" json:"type"`
	ProgramID   uint        `gorm:"not null" json:"program_id"`
	MilestoneID uint        `gorm:"not null" json:"milestone_id"`
	UserID      uint        `gorm:"not null" json:"user_id"`

	Program   Program   `gorm:"foreignKey:ProgramID" json:"-"`
	Milestone Milestone `gorm:"foreignKey:MilestoneID" json:"-"`
	User      User      `gorm:"foreignKey:UserID" json:"-"`
}

type OutcomeType string

const (
	Completion OutcomeType = "completion"
	Grade      OutcomeType = "grade"
)
