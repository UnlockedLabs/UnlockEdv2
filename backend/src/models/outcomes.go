package models

type Outcome struct {
	DatabaseFields
	Type     OutcomeType `gorm:"size:255;not null" json:"type"`
	CourseID uint        `gorm:"not null" json:"course_id"`
	UserID   uint        `gorm:"not null" json:"user_id"`
	Value    string      `gorm:"size:255" json:"value"`

	Course *Course `gorm:"foreignKey:CourseID" json:"-"`
	User   *User   `gorm:"foreignKey:UserID" json:"-"`
}

type OutcomeType string

const (
	Certificate        OutcomeType = "certificate"
	CourseCompletion   OutcomeType = "grade"
	ProgressCompletion OutcomeType = "progress_completion"
	PathwayCompletion  OutcomeType = "pathway_completion"
	CollegeCredit      OutcomeType = "college_credit"
)
