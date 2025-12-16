package models

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/teambition/rrule-go"
	"gorm.io/gorm"
)

type Attendance string

const (
	Present          Attendance = "present"
	Partial          Attendance = "partial"
	Absent_Excused   Attendance = "absent_excused"
	Absent_Unexcused Attendance = "absent_unexcused"
)

func (a Attendance) HumanReadable() string {
	switch a {
	case Present:
		return "Present"
	case Absent_Excused:
		return "Absent Excused"
	case Absent_Unexcused:
		return "Absent Unexcused"
	default:
		return string(a)
	}
}

/** Events are a physical time/place where a 'class' is held in a facility **/
type ProgramClassEvent struct {
	DatabaseFields
	ClassID        uint   `json:"class_id" gorm:"not null" validate:"required"`
	Duration       string `json:"duration" gorm:"not null" validate:"required"`
	RecurrenceRule string `json:"recurrence_rule" gorm:"not null" validate:"required"`
	RoomID         *uint  `json:"room_id" gorm:"not null"`

	/* Foreign keys */
	Class     *ProgramClass                 `json:"class" gorm:"foreignKey:ClassID;references:ID"`
	RoomRef   *Room                         `json:"room_ref,omitempty" gorm:"foreignKey:RoomID;references:ID"`
	Attendees []ProgramClassEventAttendance `json:"attendees" gorm:"foreignKey:EventID;references:ID"`
	Overrides []ProgramClassEventOverride   `json:"overrides" gorm:"foreignKey:EventID;references:ID"`
}

type DateRange struct {
	Start time.Time
	End   time.Time
	Tzone *time.Location
}

func (dt *DateRange) LoadLocation(location *time.Location) {
	dt.Start = dt.Start.In(location)
	dt.End = dt.End.In(location)
}

func (secEvent *ProgramClassEvent) BeforeCreate(tx *gorm.DB) (err error) {
	if err := secEvent.DatabaseFields.BeforeCreate(tx); err != nil {
		return err
	}
	// For events we only want to stamp creator on insert; leave update_user_id nil until first update
	secEvent.UpdateUserID = nil

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
	return e.GetRRuleWithTimezone("")
}

func (e *ProgramClassEvent) GetRRuleWithTimezone(facilityTimezone string) (*rrule.RRule, error) {
	rruleStr := e.RecurrenceRule
	if strings.Contains(rruleStr, "TZID=Local") && facilityTimezone != "" {
		rruleStr = strings.Replace(rruleStr, "TZID=Local", "TZID="+facilityTimezone, 1)
	}
	rruleOptions, err := rrule.StrToROption(rruleStr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse event recurrence rule: %w", err)
	}
	rruleOptions.Dtstart = rruleOptions.Dtstart.In(time.UTC)
	if !rruleOptions.Until.IsZero() {
		loc := rruleOptions.Until.Location()
		endOfDay := time.Date(
			rruleOptions.Until.Year(),
			rruleOptions.Until.Month(),
			rruleOptions.Until.Day(),
			23, 59, 59, int(time.Second-time.Nanosecond), loc)
		rruleOptions.Until = endOfDay.In(time.UTC)
	}
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
	EventID               uint   `json:"event_id" gorm:"not null"`
	Duration              string `json:"duration" gorm:"not null"`
	OverrideRrule         string `json:"override_rrule" gorm:"not null"`
	ClassID               uint   `json:"class_id" gorm:"->" `
	IsCancelled           bool   `json:"is_cancelled"`
	RoomID                *uint  `json:"room_id"`
	Reason                string `json:"reason"`
	LinkedOverrideEventID *uint  `json:"linked_override_event_id"`

	/* Foreign keys */
	Event   *ProgramClassEvent `json:"event" gorm:"foreignKey:EventID;references:ID"`
	RoomRef *Room              `json:"room_ref,omitempty" gorm:"foreignKey:RoomID;references:ID"`
}

func (ProgramClassEventOverride) TableName() string { return "program_class_event_overrides" }

// format argument will take a string in the format of "2006-01-02", "1/02/2006", ect
func (pce *ProgramClassEventOverride) GetFormattedOverrideDate(format string) (*string, error) {
	rRule, err := rrule.StrToRRule(pce.OverrideRrule)
	if err != nil {
		return nil, err
	}
	if len(rRule.All()) < 1 {
		return nil, errors.New("cancelled override rule does not contain a date instance")
	}
	cancelledDate := rRule.All()[0]
	cancelledDateStr := cancelledDate.Format(format)
	return StringPtr(cancelledDateStr), nil
}

func (pce *ProgramClassEventOverride) GetRescheduleSummary(timezone string) (*string, error) {
	timezoneLoc, err := time.LoadLocation(timezone)
	if err != nil {
		return nil, err
	}
	rRule, err := rrule.StrToRRule(pce.OverrideRrule)
	if err != nil {
		return nil, err
	}
	startDate := rRule.All()[0].In(timezoneLoc) //reschedule's will always be count=1 so we can do this
	duration, err := time.ParseDuration(pce.Duration)
	if err != nil {
		return nil, err
	}
	end := startDate.Add(duration)

	date := startDate.Format("1/02/2006")
	startTime := startDate.Format("3:04PM")
	endTime := end.Format("3:04PM")

	roomName := "TBD"
	if pce.RoomRef != nil {
		roomName = pce.RoomRef.Name
	}

	rescheduleSummary := date + " " + startTime + " - " + endTime + " (" + roomName + ")"
	return &rescheduleSummary, nil
}

/** Attendance records for Events **/
type ProgramClassEventAttendance struct {
	DatabaseFields
	EventID          uint       `json:"event_id" gorm:"not null;uniqueIndex:idx_event_user_date"`
	UserID           uint       `json:"user_id" gorm:"not null; uniqueIndex:idx_event_user_date"`
	Date             string     `json:"date" gorm:"not null; uniqueIndex:idx_event_user_date" validate:"required,datetime"`
	AttendanceStatus Attendance `json:"attendance_status" gorm:"column:attendance_status"`
	Note             string     `json:"note" gorm:"column:note"`
	ReasonCategory   string     `json:"reason_category" gorm:"column:reason_category"`
	CheckInAt        *string    `json:"check_in_at" gorm:"column:check_in_at"`
	CheckOutAt       *string    `json:"check_out_at" gorm:"column:check_out_at"`
	MinutesAttended  *int       `json:"minutes_attended" gorm:"column:minutes_attended"`
	ScheduledMinutes *int       `json:"scheduled_minutes" gorm:"column:scheduled_minutes"`

	/* Foreign Keys */
	Event *ProgramClassEvent `json:"event" gorm:"foreignKey:EventID;references:ID"`
	User  *User              `json:"user" gorm:"foreignKey:UserID;references:ID"`
}

func (ProgramClassEventAttendance) TableName() string { return "program_class_event_attendance" }

func (p *ProgramClassEventAttendance) BeforeCreate(tx *gorm.DB) error {
	if err := p.DatabaseFields.BeforeCreate(tx); err != nil {
		return err
	}
	return nil
}

type ClassEventInstance struct {
	EventID           uint                          `json:"event_id"`
	ClassTime         string                        `json:"class_time"` // e.g. "12:00-14:00"
	Date              string                        `json:"date"`
	AttendanceRecords []ProgramClassEventAttendance `json:"attendance_records"`
	IsCancelled       bool                          `json:"is_cancelled"`
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
	ReasonCategory   *string `json:"reason_category"`
	CheckInAt        *string `json:"check_in_at"`
	CheckOutAt       *string `json:"check_out_at"`
	MinutesAttended  *int    `json:"minutes_attended"`
	ScheduledMinutes *int    `json:"scheduled_minutes"`
}

type AttendanceFlagType string

const (
	NoAttendance     AttendanceFlagType = "no_attendance"
	MultipleAbsences AttendanceFlagType = "multiple_absences"
)

type AttendanceFlag struct {
	NameFirst string             `json:"name_first"`
	NameLast  string             `json:"name_last"`
	DocID     string             `json:"doc_id"`
	FlagType  AttendanceFlagType `json:"flag_type"`
}

type EventDates struct {
	EventID   uint   `json:"event_id"`
	Date      string `json:"date"`
	ClassTime string `json:"class_time"` // e.g. "12:00-14:00"
}

type FacilityProgramClassEvent struct {
	ProgramClassEvent
	Room                string                     `json:"room" gorm:"->"` // read-only, populated from joined rooms table
	InstructorName      string                     `json:"instructor_name"`
	ProgramName         string                     `json:"program_name"`
	ClassName           string                     `json:"title"`
	IsCancelled         bool                       `json:"is_cancelled"`
	IsOverride          bool                       `json:"is_override"`
	EnrolledUsers       string                     `json:"enrolled_users"`
	StartTime           *time.Time                 `json:"start"`
	EndTime             *time.Time                 `json:"end"`
	Frequency           string                     `json:"frequency"`
	ClassStatus         ClassStatus                `json:"class_status"`
	OverrideID          uint                       `json:"override_id"`
	LinkedOverrideEvent *FacilityProgramClassEvent `json:"linked_override_event" gorm:"-"`
}
