package models

type MilestoneType string

const (
	Interaction          MilestoneType = "interaction"   // watching video, clicking link, etc
	Completion           MilestoneType = "completion"    // completing submodule, video, etc
	Participation        MilestoneType = "participation" // formal enrollment
	QuizSubmission       MilestoneType = "quiz_submission"
	GradeReceived        MilestoneType = "grade_received"
	AssignmentSubmission MilestoneType = "assignment_submission"
	DiscussionPost       MilestoneType = "discussion_post"
)

type Milestone struct {
	DatabaseFields               // ID, CreatedAt, UpdatedAt, DeletedAt
	ProgramID      uint          `gorm:"not null" json:"program_id"`
	Type           MilestoneType `gorm:"size:255;not null" json:"type"`
	IsCompleted    bool          `gorm:"default:false" json:"is_completed"`

	Program Program `gorm:"foreignKey:ProgramID" json:"-"`
}

func (Milestone) TableName() string {
	return "milestones"
}

func (ms *Milestone) UpdateUserEngagement() {
	if ms.Type == Interaction {
		ms.Type = Completion
	}
}
