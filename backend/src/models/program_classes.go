package models

import (
	"time"
)

type ClassStatus string

const (
	Scheduled ClassStatus = "Scheduled"
	Active    ClassStatus = "Active"
	Cancelled ClassStatus = "Cancelled"
	Completed ClassStatus = "Completed"
	Paused    ClassStatus = "Paused"
	Pending   ClassStatus = "Pending"
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

	Program  *Program            `json:"program" gorm:"foreignKey:ProgramID;references:ID"`
	Facility *Facility           `json:"facility" gorm:"foreignKey:FacilityID;references:ID"`
	Events   []ProgramClassEvent `json:"events" gorm:"foreignKey:ClassID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
}

func (ProgramClass) TableName() string { return "program_classes" }

/*
ProgramClassEnrollments is a User's enrollment in a particular Program's 'class' at their respective facility,
meaning they will need to attend the ClassEvents for that class: tracked by ClassEventAttendance
*/
type ProgramClassEnrollment struct {
	DatabaseFields
	ClassID          uint   `json:"class_id" gorm:"not null"`
	UserID           uint   `json:"user_id" gorm:"not null"`
	EnrollmentStatus string `json:"enrollment_status" gorm:"size:255" validate:"max=255"`

	User  *User         `json:"user" gorm:"foreignKey:UserID;references:ID"`
	Class *ProgramClass `json:"class" gorm:"foreignKey:ClassID;references:ID"`
}

func (ProgramClassEnrollment) TableName() string { return "program_class_enrollments" }

type ProgramClassDetail struct {
	ProgramClass
	FacilityName string `json:"facility_name"`
	Enrolled     int    `json:"enrolled"`
}
