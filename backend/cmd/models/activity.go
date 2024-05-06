package models

type ActivityType string

const (
	Interaction   ActivityType = "interaction"   // watching video, clicking link, etc
	Completion    ActivityType = "completion"    // completing submodule, video, etc
	Participation ActivityType = "participation" // formal enrollment
)

type Activity struct {
	DatabaseFields
	ProgramID uint         `gorm:"not null" json:"program_id"`
	UserID    uint         `gorm:"not null" json:"user_id"`
	Type      ActivityType `gorm:"size:255;not null" json:"type"`
	// is this a url perhaps?
	ExternalID string `gorm:"size:255;not null" json:"external_content_id"`

	User    User    `gorm:"foreignKey:UserID" json:"-"`
	Program Program `gorm:"foreignKey:ProgramID" json:"-"`
}

func (Activity) TableName() string {
	return "activities"
}
