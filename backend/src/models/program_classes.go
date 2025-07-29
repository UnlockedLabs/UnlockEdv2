package models

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

type ClassStatus string

const (
	Scheduled ClassStatus = "Scheduled"
	Active    ClassStatus = "Active"
	Cancelled ClassStatus = "Cancelled"
	Completed ClassStatus = "Completed"
	Paused    ClassStatus = "Paused"
)

/*
ProgramClasses are physical 'instances' of Programs,
with a collection of Events held at a particular Facility
*/
type ProgramClass struct {
	DatabaseFields
	ProgramID      uint        `json:"program_id" gorm:"not null"`
	FacilityID     uint        `json:"facility_id" gorm:"not null"`
	Capacity       int64       `json:"capacity" gorm:"not null"`
	Name           string      `json:"name" gorm:"size:255" validate:"required,max=255"`
	InstructorName string      `json:"instructor_name" gorm:"size:255" validate:"required,max=255"`
	Description    string      `json:"description" gorm:"not null" validate:"required,max=255"`
	ArchivedAt     *time.Time  `json:"archived_at"`
	StartDt        time.Time   `gorm:"type:date" json:"start_dt"`
	EndDt          *time.Time  `gorm:"type:date" json:"end_dt"`
	Status         ClassStatus `json:"status" gorm:"type:class_status" validate:"required"`
	CreditHours    *int64      `json:"credit_hours"`
	Enrolled       int64       `json:"enrolled" gorm:"-"`
	Completed      int64       `json:"completed" gorm:"-"`
	CreateUserID   uint        `json:"create_user_id"`
	UpdateUserID   uint        `json:"update_user_id"`

	Program      *Program                 `json:"program" gorm:"foreignKey:ProgramID;references:ID"`
	Enrollments  []ProgramClassEnrollment `json:"enrollments" gorm:"foreignKey:ClassID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
	Facility     *Facility                `json:"facility" gorm:"foreignKey:FacilityID;references:ID"`
	Events       []ProgramClassEvent      `json:"events" gorm:"foreignKey:ClassID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
	FacilityProg *FacilitiesPrograms      `json:"facility_program" gorm:"foreignKey:ProgramID;references:ProgramID"`
}

func (ProgramClass) TableName() string { return "program_classes" }

// AfterUpdate hook that runs when switching class status to Active to verify existing enrollments have enrolled_at set.
func (c *ProgramClass) AfterUpdate(tx *gorm.DB) (err error) {

	// We're only worried about updating enrollment IF status changes
	if !tx.Statement.Changed("status") {
		return nil
	}

	m, ok := tx.Statement.Dest.(map[string]interface{})
	if !ok {
		return fmt.Errorf("expected tx.Statement.Dest to be a map, got %T", tx.Statement.Dest)
	}

	rawStatus := m["status"]

	var newClassStatus ClassStatus
	switch val := rawStatus.(type) {
	case string:
		newClassStatus = ClassStatus(val)
	case ClassStatus:
		newClassStatus = val
	default:
		return fmt.Errorf("unexpected type for 'status': %T", val)
	}

	// Detect Scheduled -> Active
	if newClassStatus != Active {
		return nil
	}

	rawIDs, ok := tx.Get("class_ids")
	if !ok {
		return fmt.Errorf("missing 'class_ids' in transaction context")
	}

	classIDs, ok := rawIDs.([]int)
	if !ok {
		return fmt.Errorf("expected 'class_ids' to be a []int, got %T", rawIDs)
	}
	if len(classIDs) == 0 {
		return nil
	}

	now := time.Now().UTC()

	result := tx.Model(&ProgramClassEnrollment{}).
		Where("class_id IN ?", classIDs).
		Where("enrollment_status = ?", Enrolled).
		Where("enrolled_at IS NULL").
		Update("enrolled_at", now)

	return result.Error
}

/*
ProgramClassEnrollments is a User's enrollment in a particular Program's 'class' at their respective facility,
meaning they will need to attend the ClassEvents for that class: tracked by ClassEventAttendance
*/
type ProgramClassEnrollment struct {
	DatabaseFields
	ClassID           uint                    `json:"class_id" gorm:"not null"`
	UserID            uint                    `json:"user_id" gorm:"not null"`
	EnrollmentStatus  ProgramEnrollmentStatus `json:"enrollment_status" gorm:"size:255" validate:"max=255"`
	ChangeReason      string                  `json:"change_reason" gorm:"size:255" validate:"max=255"`
	EnrolledAt        *time.Time              `json:"enrolled_at"`
	EnrollmentEndedAt *time.Time              `json:"enrollment_ended_at"`

	User  *User         `json:"user" gorm:"foreignKey:UserID;references:ID"`
	Class *ProgramClass `json:"class" gorm:"foreignKey:ClassID;references:ID"`
}

func (ProgramClassEnrollment) TableName() string { return "program_class_enrollments" }

// BeforeCreate hook that runs to set enrolled_at when enrolling in an Active class
func (e *ProgramClassEnrollment) BeforeCreate(tx *gorm.DB) (err error) {
	// allow calling code to override
	if e.EnrolledAt != nil {
		return nil
	}

	var classStatus ClassStatus
	if e.ClassID != 0 {
		if err := tx.Model(&ProgramClass{}).
			Select("status").
			Where("id = ?", e.ClassID).
			Scan(&classStatus).Error; err != nil {
			return err
		}
	}

	if classStatus == Active && e.EnrollmentStatus == Enrolled {
		tx.Statement.SetColumn("enrolled_at", time.Now().UTC())
		return nil
	}

	return nil
}

// BeforeUpdate hook that runs to set enrolled_at if enrolling in an Active class or enrollment_ended_at if entering a terminal state while class is Active|Paused.
func (e *ProgramClassEnrollment) BeforeUpdate(tx *gorm.DB) (err error) {
	// allow calling code to override
	if !tx.Statement.Changed("enrollment_status") ||
		tx.Statement.Changed("enrolled_at") ||
		tx.Statement.Changed("enrollment_ended_at") {
		return nil
	}

	var newEnrollmentStatus ProgramEnrollmentStatus
	if m, ok := tx.Statement.Dest.(map[string]interface{}); ok {
		if v, ok := m["enrollment_status"]; ok {
			switch val := v.(type) {
			case string:
				newEnrollmentStatus = ProgramEnrollmentStatus(val)
			case ProgramEnrollmentStatus:
				newEnrollmentStatus = val
			default:
				return fmt.Errorf("unknown type %T", val)
			}
		}
	}

	var classID int
	if v, ok := tx.Get("class_id"); ok {
		classID = v.(int)
	}

	var classStatus ClassStatus
	if classID != 0 {
		if err := tx.Model(&ProgramClass{}).
			Select("status").
			Where("id = ?", classID).
			Scan(&classStatus).Error; err != nil {
			return err
		}
	}

	// This likely gets hit when we introduce "Waitlist" as a status
	if newEnrollmentStatus == Enrolled && classStatus == Active {
		tx.Statement.SetColumn("enrolled_at", time.Now().UTC())
		// ? do we need to worry about updating fields to the same value (enrolled -> enrolled)?
	}

	// This is when an enrollment ends while the class remains active
	if IsTerminalEnrollment(newEnrollmentStatus) && (classStatus == Active || classStatus == Paused) {
		tx.Statement.SetColumn("enrollment_ended_at", time.Now().UTC())
	}

	return nil
}

func IsTerminalEnrollment(s ProgramEnrollmentStatus) bool {
	return s == EnrollmentCancelled || s == EnrollmentCompleted ||
		strings.HasPrefix(string(s), "Incomplete:")
}

type ProgramClassDetail struct {
	ProgramClass
	FacilityName string `json:"facility_name"`
	Enrolled     int    `json:"enrolled"`
}

type ProgramEnrollmentStatus string

const (
	Enrolled                             ProgramEnrollmentStatus = "Enrolled"
	EnrollmentCancelled                  ProgramEnrollmentStatus = "Cancelled"
	EnrollmentCompleted                  ProgramEnrollmentStatus = "Completed"
	EnrollmentIncompleteWithdrawn        ProgramEnrollmentStatus = "Incomplete: Withdrawn"
	EnrollmentIncompleteDropped          ProgramEnrollmentStatus = "Incomplete: Dropped"
	EnrollmentIncompleteFailedToComplete ProgramEnrollmentStatus = "Incomplete: Failed to Complete"
	EnrollmentIncompleteTransfered       ProgramEnrollmentStatus = "Incomplete: Transfered"
	EnrollmentIncompleteSegregated       ProgramEnrollmentStatus = "Incomplete: Segregated"
)

type ProgramCompletion struct {
	DatabaseFields
	UserID              uint      `json:"user_id" gorm:"not null"`
	ProgramClassID      uint      `json:"program_class_id" gorm:"not null"`
	FacilityName        string    `json:"facility_name" gorm:"not null"`
	CreditType          string    `json:"credit_type" gorm:"not null"`
	AdminEmail          string    `json:"admin_email" gorm:"not null"`
	ProgramOwner        string    `json:"program_owner" gorm:"not null"`
	ProgramName         string    `json:"program_name" gorm:"not null"`
	ProgramID           uint      `json:"program_id" gorm:"not null"`
	ProgramClassName    string    `json:"program_class_name"`
	ProgramClassStartDt time.Time `json:"program_class_start_dt"`
	EnrolledOnDt        time.Time `json:"enrolled_on_dt"`

	User *User `json:"user" gorm:"foreignKey:UserID;references:ID"`
}

func (ProgramCompletion) TableName() string { return "program_completions" }

type ProgramClassesHistory struct {
	ID           uint            `json:"id"`
	ParentRefID  uint            `json:"parent_ref_id"`
	NameTable    string          `json:"table_name" gorm:"column:table_name;size:255"` // cant use TableName because used below
	BeforeUpdate json.RawMessage `json:"before_update" gorm:"type:json"`
	AfterUpdate  json.RawMessage `json:"after_update" gorm:"type:json"`
	CreatedAt    time.Time       `json:"created_at"`
}

func (ProgramClassesHistory) TableName() string { return "program_classes_history" }

func (pc *ProgramClass) CannotUpdateClass() bool {
	return pc.Status == Completed || pc.Status == Cancelled || pc.ArchivedAt != nil
}
