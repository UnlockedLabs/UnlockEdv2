package models

type Facility struct {
	DatabaseFields
	Name     string               `gorm:"size:255;not null" json:"name"`
	Timezone string               `gorm:"size:255;not null" json:"timezone" validate:"timezone"`
	Users    []User               `gorm:"foreignKey:FacilityID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;" json:"-"`
	Programs []FacilitiesPrograms `json:"programs" gorm:"many2many:facilities_programs;"`
}

func (Facility) TableName() string {
	return "facilities"
}
