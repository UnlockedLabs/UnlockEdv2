package models

import (
	"errors"
	"fmt"
	"time"

	"github.com/teambition/rrule-go"
	"gorm.io/gorm"
)

type Attendance string

const (
	Present          Attendance = "present"
	Absent_Excused   Attendance = "absent_excused"
	Absent_Unexcused Attendance = "absent_unexcused"
)

/** Events are a physical time/place where a 'class' is held in a facility **/
type ProgramClassEvent struct {
	DatabaseFields
	ClassID        uint   `json:"class_id" gorm:"not null" validate:"required"`
	Duration       string `json:"duration" gorm:"not null" validate:"required"`
	RecurrenceRule string `json:"recurrence_rule" gorm:"not null" validate:"required"`
	Room           string `json:"room" gorm:"not null;default:TBD"`

	/* Foreign keys */
	Class     *ProgramClass                 `json:"class" gorm:"foreignKey:ClassID;references:ID"`
	Attendees []ProgramClassEventAttendance `json:"attendees" gorm:"foreignKey:EventID;references:ID"`
	Overrides []ProgramClassEventOverride   `json:"overrides" gorm:"foreignKey:EventID;references:ID"`
}

func (secEvent *ProgramClassEvent) BeforeCreate(tx *gorm.DB) (err error) {
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

func (ProgramClassEvent) TableName() string { return "program_class_events" }

func (e *ProgramClassEvent) GetRRule() (*rrule.RRule, error) {
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

func (event *ProgramClassEvent) RRuleUntil() (time.Time, error) {
	rrule, err := event.GetRRule()
	if err != nil {
		return time.Time{}, err
	}
	return rrule.GetUntil(), nil
}

/** Overrides are used to cancel or reschedule events **/
type ProgramClassEventOverride struct {
	DatabaseFields
	EventID       uint   `json:"event_id" gorm:"not null"`
	Duration      string `json:"duration" gorm:"not null"`
	OverrideRrule string `json:"override_rrule" gorm:"not null"`
	IsCancelled   bool   `json:"is_cancelled"`
	Room          string `json:"room"`

	/* Foreign keys */
	Event *ProgramClassEvent `json:"event" gorm:"foreignKey:EventID;references:ID"`
}

func (ProgramClassEventOverride) TableName() string { return "program_class_event_overrides" }

/** Attendance records for Events **/
type ProgramClassEventAttendance struct {
	DatabaseFields
	EventID          uint       `json:"event_id" gorm:"not null;uniqueIndex:idx_event_user_date"`
	UserID           uint       `json:"user_id" gorm:"not null; uniqueIndex:idx_event_user_date"`
	Date             string     `json:"date" gorm:"not null; uniqueIndex:idx_event_user_date" validate:"required,datetime"`
	AttendanceStatus Attendance `json:"attendance_status" gorm:"column:attendance_status"`
	Note             string     `json:"note" gorm:"column:note"`

	/* Foreign Keys */
	Event *ProgramClassEvent `json:"event" gorm:"foreignKey:EventID;references:ID"`
	User  *User              `json:"user" gorm:"foreignKey:UserID;references:ID"`
}

func (ProgramClassEventAttendance) TableName() string { return "program_class_event_attendance" }

type ClassEventInstance struct {
	EventID           uint                          `json:"event_id"`
	ClassTime         string                        `json:"class_time"` // e.g. "12:00-14:00"
	Date              string                        `json:"date"`
	AttendanceRecords []ProgramClassEventAttendance `json:"attendance_records"`
}

type EnrollmentAttendance struct {
	EnrollmentID     uint    `json:"enrollment_id"`
	ClassID          uint    `json:"class_id"`
	EnrollmentStatus string  `json:"enrollment_status"`
	UserID           uint    `json:"user_id"`
	NameFirst        string  `json:"name_first"`
	NameLast         string  `json:"name_last"`
	DocID            string  `json:"doc_id"`
	AttendanceID     *uint   `json:"attendance_id"`
	EventID          *uint   `json:"event_id"`
	EventDate        *string `json:"date"`
	AttendanceStatus *string `json:"attendance_status"`
	Note             *string `json:"note"`
}
