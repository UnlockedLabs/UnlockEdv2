package models

/** Events are a physical time/place where a 'section' is held in a facility **/
type SectionEvent struct {
	DatabaseFields
	SectionID      uint   `json:"section_id" gorm:"not null"`
	StartTime      string `json:"start_time" gorm:"not null"`
	EndTime        string `json:"end_time" gorm:"not null"`
	RecurrenceRule string `json:"recurrence_rule" gorm:"not null"`

	/* Foreign keys */
	Section   *ProgramSection          `json:"section" gorm:"foreignKey:SectionID;references:ID"`
	Attendees []SectionEventAttendance `json:"attendees" gorm:"foreignKey:EventID;references:ID"`
}

func (SectionEvent) TableName() string { return "section_events" }

/** Overrides are used to cancel or reschedule events **/
type SectionEventOverride struct {
	DatabaseFields
	EventID      uint   `json:"event_id" gorm:"not null"`
	StartTime    string `json:"start_time" gorm:"not null"`
	EndTime      string `json:"end_time" gorm:"not null"`
	OverrideRule string `json:"override_rule" gorm:"not null"`
	IsCancelled  bool   `json:"is_cancelled" gorm:"not null"`

	/* Foreign keys */
	Event *SectionEvent `json:"event" gorm:"foreignKey:EventID;references:ID"`
}

func (SectionEventOverride) TableName() string { return "section_event_overrides" }

/** Attendance records for Events **/
type SectionEventAttendance struct {
	DatabaseFields
	EventID uint `json:"event_id" gorm:"not null"`
	UserID  uint `json:"user_id" gorm:"not null"`

	/* Foreign Keys */
	Event *SectionEvent `json:"event" gorm:"foreignKey:EventID;references:ID"`
	User  *User         `json:"user" gorm:"foreignKey:UserID;references:ID"`
}

func (SectionEventAttendance) TableName() string { return "section_event_attendance" }
