package models

type Outcome struct {
	DatabaseFields
	Type      OutcomeType `gorm:"size:255;not null" json:"type"`
	ProgramID uint        `gorm:"not null" json:"program_id"`
	UserID    uint        `gorm:"not null" json:"user_id"`
	Value     string      `gorm:"size:255" json:"value"`

	Program *Program `gorm:"foreignKey:ProgramID" json:"-"`
	User    *User    `gorm:"foreignKey:UserID" json:"-"`
}

type OutcomeType string

const (
	Certificate        OutcomeType = "certificate"
	ProgramCompletion  OutcomeType = "grade"
	ProgressCompletion OutcomeType = "progress_completion"
	PathwayCompletion  OutcomeType = "pathway_completion"
	CollegeCredit      OutcomeType = "college_credit"
)
