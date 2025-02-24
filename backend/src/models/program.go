package models

type Program struct {
	DatabaseFields
	Name          string `json:"name" gorm:"not null;unique" validate:"required,max=255"`
	Description   string `json:"description" gorm:"not null" validate:"required,max=255"`
	CreditType    string `json:"credit_type" gorm:"not null" validate:"required,max=50"`
	ProgramStatus string `json:"program_status" gorm:"not null" validate:"required,max=50"`
	ProgramType   string `json:"program_type" gorm:"not null" validate:"required,max=50"`
	IsFavorited   bool   `json:"is_favorited" gorm:"-"`

	Tags       []ProgramTag      `json:"tags" gorm:"foreignKey:ProgramID;references:ID"`
	Facilities []Facility        `json:"facilities" gorm:"many2many:facilities_programs;"`
	Favorites  []ProgramFavorite `json:"-" gorm:"foreignKey:ProgramID;references:ID"`
}

func (Program) TableName() string { return "programs" }

type ProgramTag struct {
	TagID      uint `json:"tag_id" gorm:"not null" validate:"required"`
	ProgramID  uint `json:"program_id" gorm:"not null" validate:"required"`
	FacilityID uint `json:"facility_id" gorm:"not null" validate:"required"`

	Program  *Program  `json:"program" gorm:"foreignKey:ProgramID;references:ID"`
	Facility *Facility `json:"facility" gorm:"foreignKey:FacilityID;references:ID"`
}

func (ProgramTag) TableName() string { return "program_tags" }

type FacilitiesPrograms struct {
	DatabaseFields
	ProgramID  uint `json:"program_id"`
	FacilityID uint `json:"facility_id"`

	Program  *Program  `json:"-" gorm:"foreignKey:ProgramID;references:ID"`
	Facility *Facility `json:"-" gorm:"foreignKey:FacilityID;references:ID"`
}

func (FacilitiesPrograms) TableName() string { return "facilities_programs" }
