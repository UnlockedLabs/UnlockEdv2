package models

type MilestoneType string

const (
	Enrollment           MilestoneType = "enrollment"
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

type UnlockEdImportMilestone struct {
	UserID            int    `json:"user_id"`
	ExternalProgramID string `json:"external_program_id"`
	ExternalID        string `json:"external_id"`
	Type              string `json:"type"`
	IsCompleted       bool   `json:"is_completed"`
}

func (Milestone) TableName() string {
	return "milestones"
}
