package models

type ActivityType string

const (
	ProgramInteraction ActivityType = "interaction" // watching video, clicking link, etc
	ContentInteraction ActivityType = "completion"  // completing submodule, video, etc
)

type Activity struct {
	DatabaseFields
	ProgramID uint         `gorm:"not null" json:"program_id"`
	UserID    uint         `gorm:"not null" json:"user_id"`
	Type      ActivityType `gorm:"size:255;not null" json:"type"`
	TotalTime uint         `json:"total_time"`
	TimeDelta uint         `json:"time_delta"`

	// is this a url perhaps?
	ExternalID string `gorm:"size:255;not null" json:"external_content_id"`

	User    *User    `gorm:"foreignKey:UserID" json:"-"`
	Program *Program `gorm:"foreignKey:ProgramID" json:"-"`
}

func (Activity) TableName() string {
	return "activities"
}
