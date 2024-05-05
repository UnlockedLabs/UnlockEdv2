package models

type MilestoneType string

const (
	Interaction   MilestoneType = "interaction"
	Engagement    MilestoneType = "engagement"
	Participation MilestoneType = "participation"
)

type Milestone struct {
	DatabaseFields
	ProgramID   uint          `gorm:"not null" json:"program_id"`
	Type        MilestoneType `gorm:"size:255;not null" json:"type"`
	IsCompleted bool          `gorm:"default:false" json:"is_completed"`

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
