package models

/*
ProgramSections are physical 'instances' of Programs,
with a collection of Events held at a particular Facility
*/
type ProgramSection struct {
	DatabaseFields
	ProgramID  uint `json:"program_id" gorm:"not null"`
	FacilityID uint `json:"facility_id" gorm:"not null"`

	Program  *Program              `json:"program" gorm:"foreignKey:ProgramID;references:ID"`
	Facility *Facility             `json:"-" gorm:"foreignKey:FacilityID;references:ID"`
	Events   []ProgramSectionEvent `json:"events" gorm:"foreignKey:SectionID;references:ID"`
}

func (ProgramSection) TableName() string { return "program_sections" }

/*
ProgramSectionEnrollments is a User's enrollment in a particular Program's 'section' at their respective facility,
meaning they will need to attend the SectionEvents for that section: tracked by SectionEventAttendance
*/
type ProgramSectionEnrollment struct {
	DatabaseFields
	SectionID uint `json:"section_id" gorm:"not null"`
	UserID    uint `json:"user_id" gorm:"not null"`

	User    *User           `json:"user" gorm:"foreignKey:UserID;references:ID"`
	Section *ProgramSection `json:"section" gorm:"foreignKey:SectionID;references:ID"`
}

func (ProgramSectionEnrollment) TableName() string { return "program_section_enrollments" }
