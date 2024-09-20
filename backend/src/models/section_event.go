package models

import (
	"errors"
	"time"

	"github.com/teambition/rrule-go"
	"gorm.io/gorm"
)

/** Events are a physical time/place where a 'section' is held in a facility **/
type ProgramSectionEvent struct {
	DatabaseFields
	SectionID      uint   `json:"section_id" gorm:"not null" validate:"required"`
	Duration       string `json:"duration" gorm:"not null" validate:"required"`
	RecurrenceRule string `json:"recurrence_rule" gorm:"not null" validate:"required"`
	Location       string `json:"location" gorm:"not null;default:TBD"`

	/* Foreign keys */
	Section   *ProgramSection                 `json:"section" gorm:"foreignKey:SectionID;references:ID"`
	Attendees []ProgramSectionEventAttendance `json:"attendees" gorm:"foreignKey:EventID;references:ID"`
	Overrides []ProgramSectionEventOverride   `json:"overrides" gorm:"foreignKey:EventID;references:ID"`
}

func (secEvent *ProgramSectionEvent) BeforeCreate(tx *gorm.DB) (err error) {
	duration, parseErr := time.ParseDuration(secEvent.Duration)
	if parseErr != nil {
		err = parseErr
		return
	}
	if duration <= 0 {
		err = errors.New("Duration cannot be negative")
		return
	}
	_, err = rrule.StrToRRule(secEvent.RecurrenceRule)
	if err != nil {
		return err
	}
	return
}

func (ProgramSectionEvent) TableName() string { return "program_section_events" }

/** Overrides are used to cancel or reschedule events **/
type ProgramSectionEventOverride struct {
	DatabaseFields
	EventID       uint   `json:"event_id" gorm:"not null"`
	Duration      string `json:"duration" gorm:"not null"`
	OverrideRRule string `json:"override_rrule" gorm:"not null"`
	IsCancelled   bool   `json:"is_cancelled" gorm:"not null"`

	/* Foreign keys */
	Event *ProgramSectionEvent `json:"event" gorm:"foreignKey:EventID;references:ID"`
}

func (ProgramSectionEventOverride) TableName() string { return "program_section_event_overrides" }

/** Attendance records for Events **/
type ProgramSectionEventAttendance struct {
	DatabaseFields
	EventID uint   `json:"event_id" gorm:"not null"`
	UserID  uint   `json:"user_id" gorm:"not null"`
	Date    string `json:"date" gorm:"not null" validate:"required,datetime"`

	/* Foreign Keys */
	Event *ProgramSectionEvent `json:"event" gorm:"foreignKey:EventID;references:ID"`
	User  *User                `json:"user" gorm:"foreignKey:UserID;references:ID"`
}

func (ProgramSectionEventAttendance) TableName() string { return "program_section_event_attendance" }
