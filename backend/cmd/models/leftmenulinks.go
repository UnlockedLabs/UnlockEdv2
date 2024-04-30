package models

import (
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type LeftMenuLink struct {
	gorm.Model
	ID    int            `gorm:"primaryKey" json:"id"`
	Name  string         `gorm:"size:255;not null" json:"name"`
	Rank  int            `gorm:"default:1" json:"rank"`
	Links datatypes.JSON `json:"links" gorm:"jsonb"`
}

func (LeftMenuLink) TableName() string {
	return "left_menu_links"
}
