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
	CourseID       uint          `gorm:"not null" json:"course_id"`
	ExternalID     string        `gorm:"size:255;not null;unique" json:"external_id"`
	Type           MilestoneType `gorm:"size:255;not null" json:"type"`
	IsCompleted    bool          `gorm:"default:false" json:"is_completed"`

	User   *User   `gorm:"foreignKey:UserID" json:"-"`
	Course *Course `gorm:"foreignKey:CourseID" json:"-"`
}

func (Milestone) TableName() string {
	return "milestones"
}
