package models

type Tag struct {
	ID   uint   `gorm:"primaryKey" json:"key"`
	Name string `gorm:"size:255;not null" json:"value"`
}

func (Tag) TableName() string { return "tags" }
