package models

type MilestoneType string

const (
	Enrollment           MilestoneType = "enrollment"
	QuizSubmission       MilestoneType = "quiz_submission"
	AssignmentSubmission MilestoneType = "assignment_submission"
	GradeReceived        MilestoneType = "grade_received"
	DiscussionPost       MilestoneType = "discussion_post"
)

type Milestone struct {
	DatabaseFields               // ID, CreatedAt, UpdatedAt, DeletedAt
	UserID         uint          `gorm:"not null" json:"user_id"`
	ProgramID      uint          `gorm:"not null" json:"program_id"`
	ExternalID     string        `gorm:"size:255;not null" json:"external_id"`
	Type           MilestoneType `gorm:"size:255;not null" json:"type"`
	IsCompleted    bool          `gorm:"default:false" json:"is_completed"`

	User    *User    `gorm:"foreignKey:UserID" json:"-"`
	Program *Program `gorm:"foreignKey:ProgramID" json:"-"`
}

type ImportMilestone struct {
	UserID            int    `json:"user_id"`
	ExternalProgramID string `json:"external_program_id"`
	ExternalID        string `json:"external_id"`
	Type              string `json:"type"`
	IsCompleted       bool   `json:"is_completed"`
}

func (Milestone) TableName() string {
	return "milestones"
}
