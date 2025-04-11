package models

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
