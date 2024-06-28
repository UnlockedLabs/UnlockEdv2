package models

type Facility struct {
	DatabaseFields
	Name string `gorm:"size:255;not null" json:"name"`
}

func (Facility) TableName() string {
	return "facilities"
}
