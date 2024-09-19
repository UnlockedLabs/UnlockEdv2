package models

import (
	"errors"
	"strings"
	"time"

	"github.com/teambition/rrule-go"
	"gorm.io/gorm"
)

/** Events are a physical time/place where a 'section' is held in a facility **/
type SectionEvent struct {
	DatabaseFields
	SectionID      uint   `json:"section_id" gorm:"not null" validate:"required"`
	StartTime      string `json:"start_time" gorm:"not null" validate:"required,datetime"`
	Duration       string `json:"duration" gorm:"not null" validate:"required"`
	RecurrenceRule string `json:"recurrence_rule" gorm:"not null" validate:"required"`
	Location       string `json:"location" gorm:"not null;default:TBD"`

	/* Foreign keys */
	Section   *ProgramSection          `json:"section" gorm:"foreignKey:SectionID;references:ID"`
	Attendees []SectionEventAttendance `json:"attendees" gorm:"foreignKey:EventID;references:ID"`
	Overrides []SectionEventOverride   `json:"overrides" gorm:"foreignKey:EventID;references:ID"`
}

func (secEvent *SectionEvent) BeforeCreate(tx *gorm.Tx) (err error) {
	_, err = time.Parse(time.RFC3339, secEvent.StartTime)
	if err != nil {
		return err
	}
	duration, parseErr := time.ParseDuration(secEvent.Duration)
	if parseErr != nil {
		err = parseErr
		return
	}
	if duration <= 0 {
		err = errors.New("Duration cannot be negative")
		return
	}
	if !strings.HasPrefix(secEvent.RecurrenceRule, "RRULE:") {
		secEvent.RecurrenceRule = "RRULE:" + secEvent.RecurrenceRule
	}
	_, err = rrule.StrToRRule(secEvent.RecurrenceRule)
	if err != nil {
		return err
	}
	return
}

func (SectionEvent) TableName() string { return "section_events" }

/** Overrides are used to cancel or reschedule events **/
type SectionEventOverride struct {
	DatabaseFields
	EventID       uint   `json:"event_id" gorm:"not null"`
	StartTime     string `json:"start_time" gorm:"not null"`
	Duration      string `json:"duration" gorm:"not null"`
	OverrideRRule string `json:"override_rrule" gorm:"not null"`
	IsCancelled   bool   `json:"is_cancelled" gorm:"not null"`

	/* Foreign keys */
	Event *SectionEvent `json:"event" gorm:"foreignKey:EventID;references:ID"`
}

func (SectionEventOverride) TableName() string { return "section_event_overrides" }

/** Attendance records for Events **/
type SectionEventAttendance struct {
	DatabaseFields
	EventID uint   `json:"event_id" gorm:"not null"`
	UserID  uint   `json:"user_id" gorm:"not null"`
	Date    string `json:"date" gorm:"not null" validate:"required,datetime"`

	/* Foreign Keys */
	Event *SectionEvent `json:"event" gorm:"foreignKey:EventID;references:ID"`
	User  *User         `json:"user" gorm:"foreignKey:UserID;references:ID"`
}

func (SectionEventAttendance) TableName() string { return "section_event_attendance" }
