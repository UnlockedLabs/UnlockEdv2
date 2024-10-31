package models

type Program struct {
	DatabaseFields
	Name        string `json:"name" gorm:"not null;unique" validate:"required,max=255"`
	Description string `json:"description" gorm:"not null" validate:"required,max=255"`
	CreditType  string `json:"credit_type" gorm:"not null" validate:"required,max=255"`

	Tags       []ProgramTag         `json:"tags" gorm:"foreignKey:ProgramID;references:ID"`
	Facilities []FacilitiesPrograms `json:"facilities" gorm:"many2many:facilities_programs;"`
}

// `gorm:"many2many:user_languages;"`
func (Program) TableName() string { return "programs" }

type ProgramTag struct {
	DatabaseFields
	ProgramID uint   `json:"program_id" gorm:"not null" validate:"required"`
	Value     string `json:"value" gorm:"not null" validate:"required"`

	Program *Program `json:"-" gorm:"foreignKey:ProgramID;references:ID"`
}

func (ProgramTag) TableName() string { return "program_tags" }

type FacilitiesPrograms struct {
	DatabaseFields
	ProgramID  uint `json:"program_id" gorm:"not null" validate:"required"`
	FacilityID uint `json:"facility_id" gorm:"not null" validate:"required"`
}
