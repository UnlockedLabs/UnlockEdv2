package models

type Program struct {
	DatabaseFields
	Name        string `json:"name" gorm:"not null;unique"`
	Description string `json:"description" gorm:"not null"`

	Tags []ProgramTag `json:"tags" gorm:"foreignKey:ProgramID;references:ID"`
}

func (Program) TableName() string { return "programs" }

type ProgramTag struct {
	DatabaseFields
	ProgramID uint   `json:"program_id" gorm:"not null"`
	Value     string `json:"value" gorm:"not null"`

	Program *Program `json:"program" gorm:"foreignKey:ProgramID;references:ID"`
}

func (ProgramTag) TableName() string { return "program_tags" }
