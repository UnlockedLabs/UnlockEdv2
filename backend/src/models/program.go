package models

import "time"

type FundingType string
type ProgType string
type CreditType string

const (
	//funding types
	FederalGrants FundingType = "Federal_Grants"
	StateGrants   FundingType = "State_Grants"
	NonProfitOrgs FundingType = "Nonprofit_Organizations"
	EduGrants     FundingType = "Educational_Grants"
	InmateWelfare FundingType = "Inmate_Welfare_Funds"
	Other         FundingType = "Other"
	//program types
	Educational  ProgType = "Educational"
	Vocational   ProgType = "Vocational"
	MentalHealth ProgType = "Mental_Health_Behavioral"
	Religious    ProgType = "Religious_Faith-Based"
	ReEntry      ProgType = "Re-Entry"
	Therapeutic  ProgType = "Therapeutic"
	LifeSkills   ProgType = "Life_Skills"
	//credit types
	Completion    CreditType = "Completion"
	Participation CreditType = "Participation"
	EarnedTime    CreditType = "Earned-time"
	Education     CreditType = "Education"
)

type Program struct {
	DatabaseFields
	Name        string      `json:"name" gorm:"not null;unique" validate:"required,max=255"`
	Description string      `json:"description" gorm:"not null" validate:"required,max=255"`
	FundingType FundingType `json:"funding_type" gorm:"type:funding_type" validate:"required"`
	IsActive    bool        `json:"is_active" gorm:"not null"`
	IsFavorited bool        `json:"is_favorited" gorm:"-"`
	ArchivedAt  *time.Time  `json:"archived_at"`

	ProgramTypes       []ProgramType       `json:"program_types" gorm:"foreignKey:ProgramID;references:ID"`
	ProgramCreditTypes []ProgramCreditType `json:"credit_types" gorm:"foreignKey:ProgramID;references:ID"`
	Facilities         []Facility          `json:"facilities" gorm:"many2many:facilities_programs;"`
	Favorites          []ProgramFavorite   `json:"-" gorm:"foreignKey:ProgramID;references:ID"`
	Classes            []ProgramClass      `json:"-" gorm:"foreignKey:ProgramID;references:ID"`
}

func (Program) TableName() string { return "programs" }

type ProgramType struct {
	ProgramType ProgType `json:"program_type" gorm:"type:program_type" validate:"required"`
	ProgramID   uint     `json:"program_id" gorm:"not null" validate:"required"`

	Program *Program `json:"program" gorm:"foreignKey:ProgramID;references:ID"`
}

func (ProgramType) TableName() string { return "program_types" }

type ProgramCreditType struct {
	CreditType CreditType `json:"credit_type" gorm:"type:credit_type" validate:"required"`
	ProgramID  uint       `json:"program_id" gorm:"not null" validate:"required"`

	Program *Program `json:"program" gorm:"foreignKey:ProgramID;references:ID"`
}

func (ProgramCreditType) TableName() string { return "program_credit_types" }

type ProgramTypeInfo struct {
	ProgramTypes       []ProgType
	ProgramCreditTypes []CreditType
}

type FacilitiesPrograms struct {
	DatabaseFields
	ProgramID    uint   `json:"program_id"`
	FacilityID   uint   `json:"facility_id"`
	ProgramOwner string `json:"program_owner" gorm:"size:255;column:program_owner" validate:"max=255"`

	Program  *Program  `json:"-" gorm:"foreignKey:ProgramID;references:ID"`
	Facility *Facility `json:"-" gorm:"foreignKey:FacilityID;references:ID"`
}

func (FacilitiesPrograms) TableName() string { return "facilities_programs" }

type DailyProgramsFacilitiesHistory struct {
	Date                   time.Time `json:"date" gorm:"not null"`
	TotalPrograms          int64     `json:"total_programs" gorm:"not null"`
	TotalActivePrograms    int64     `json:"total_active_programs" gorm:"not null"`
	TotalArchivedPrograms  int64     `json:"total_archived_programs" gorm:"not null"`
	TotalEnrollments       int64     `json:"total_enrollments" gorm:"not null"`
	TotalCompletions       int64     `json:"total_completions" gorm:"not null"`
	TotalProgramOfferings  int64     `json:"total_program_offerings" gorm:"not null"`
	TotalFacilities        int64     `json:"total_facilities" gorm:"not null"`
	TotalAttendancesMarked int64     `json:"total_attendances_marked" gorm:"not null"`
	TotalStudentsPresent   int64     `json:"total_students_present" gorm:"not null"`
}

func (DailyProgramsFacilitiesHistory) TableName() string {
	return "daily_programs_facilities_history"
}

type DailyProgramFacilitiesHistory struct {
	Date                   time.Time `json:"date" gorm:"not null"`
	ProgramID              uint      `json:"program_id" gorm:"not null"`
	TotalActiveFacilities  int64     `json:"total_active_facilities" gorm:"not null"`
	TotalEnrollments       int64     `json:"total_enrollments" gorm:"not null"`
	TotalCompletions       int64     `json:"total_completions" gorm:"not null"`
	TotalActiveEnrollments int64     `json:"total_active_enrollments" gorm:"not null"`
	TotalClasses           int64     `json:"total_classes" gorm:"not null"`
	TotalArchivedClasses   int64     `json:"total_archived_classes" gorm:"not null"`
	TotalAttendancesMarked int64     `json:"total_attendances_marked" gorm:"not null"`
	TotalStudentsPresent   int64     `json:"total_students_present" gorm:"not null"`
}

func (DailyProgramFacilitiesHistory) TableName() string {
	return "daily_program_facilities_history"
}

type DailyProgramFacilityHistory struct {
	Date                   time.Time `json:"date" gorm:"not null"`
	ProgramID              uint      `json:"program_id" gorm:"not null"`
	FacilityID             uint      `json:"facility_id" gorm:"not null"`
	TotalEnrollments       int64     `json:"total_enrollments" gorm:"not null"`
	TotalCompletions       int64     `json:"total_completions" gorm:"not null"`
	TotalActiveEnrollments int64     `json:"total_active_enrollments" gorm:"not null"`
	TotalClasses           int64     `json:"total_classes" gorm:"not null"`
	TotalArchivedClasses   int64     `json:"total_archived_classes" gorm:"not null"`
	TotalAttendancesMarked int64     `json:"total_attendances_marked" gorm:"not null"`
	TotalStudentsPresent   int64     `json:"total_students_present" gorm:"not null"`
}

func (DailyProgramFacilityHistory) TableName() string {
	return "daily_program_facility_history"
}

type ProgramsFacilitiesStats struct {
	TotalPrograms                int64   `json:"total_programs"`
	AvgActiveProgramsPerFacility int64   `json:"avg_active_programs_per_facility"`
	TotalEnrollments             int64   `json:"total_enrollments"`
	AttendanceRate               float64 `json:"attendance_rate"`
	CompletionRate               float64 `json:"completion_rate"`
}

type ProgramsOverviewTable struct {
	ProgramID              uint    `json:"program_id"`
	ProgramName            string  `json:"program_name"`
	ArchivedAt             *string `json:"archived_at"`
	TotalActiveFacilities  int64   `json:"total_active_facilities"`
	TotalEnrollments       int64   `json:"total_enrollments"`
	TotalActiveEnrollments int64   `json:"total_active_enrollments"`
	TotalClasses           int64   `json:"total_classes"`
	CompletionRate         float64 `json:"completion_rate"`
	AttendanceRate         float64 `json:"attendance_rate"`
	Types                  string  `json:"program_types" gorm:"column:program_types"`
	CreditTypes            string  `json:"credit_types"`
	FundingType            string  `json:"funding_type"`
	Status                 bool    `json:"status"`
}

type ProgramsOverview struct {
	ProgramsFacilitiesStats ProgramsFacilitiesStats `json:"programs_facilities_stats"`
	ProgramsTable           []ProgramsOverviewTable `json:"programs_table"`
}
