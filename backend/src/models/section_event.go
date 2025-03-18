package models

import (
	"errors"
	"fmt"
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
	Room           string `json:"room" gorm:"not null;default:TBD"`

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
		err = errors.New("duration cannot be negative")
		return
	}
	_, err = rrule.StrToRRule(secEvent.RecurrenceRule)
	if err != nil {
		return err
	}
	return
}

func (ProgramSectionEvent) TableName() string { return "program_section_events" }

func (e *ProgramSectionEvent) GetRRule() (*rrule.RRule, error) {
	rruleOptions, err := rrule.StrToROption(e.RecurrenceRule)
	if err != nil {
		return nil, fmt.Errorf("failed to parse event recurrence rule: %w", err)
	}
	rruleOptions.Dtstart = rruleOptions.Dtstart.In(time.UTC)
	rule, err := rrule.NewRRule(*rruleOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to create event recurrence rule: %w", err)
	}
	return rule, nil
}

func (event *ProgramSectionEvent) RRuleUntil() (time.Time, error) {
	rrule, err := event.GetRRule()
	if err != nil {
		return time.Time{}, err
	}
	return rrule.GetUntil(), nil
}

/** Overrides are used to cancel or reschedule events **/
type ProgramSectionEventOverride struct {
	DatabaseFields
	EventID       uint   `json:"event_id" gorm:"not null"`
	Duration      string `json:"duration" gorm:"not null"`
	OverrideRrule string `json:"override_rrule" gorm:"not null"`
	IsCancelled   bool   `json:"is_cancelled"`
	Location      string `json:"location"`

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
