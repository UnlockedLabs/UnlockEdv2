package models

type MilestoneType string

const (
	QuizSubmission       MilestoneType = "quiz_submission"
	GradeReceived        MilestoneType = "grade_received"
	AssignmentSubmission MilestoneType = "assignment_submission"
	DiscussionPost       MilestoneType = "discussion_post"
)

type Milestone struct {
	DatabaseFields               // ID, CreatedAt, UpdatedAt, DeletedAt
	ProgramID      uint          `gorm:"not null" json:"program_id"`
	ExternalID     string        `gorm:"size:255;not null" json:"external_id"`
	Type           MilestoneType `gorm:"size:255;not null" json:"type"`
	IsCompleted    bool          `gorm:"default:false" json:"is_completed"`

	Program *Program `gorm:"foreignKey:ProgramID" json:"-"`
}

func (Milestone) TableName() string {
	return "milestones"
}
