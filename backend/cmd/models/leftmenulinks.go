package models

import (
	"gorm.io/datatypes"
)

type LeftMenuLink struct {
	ID    int            `gorm:"primaryKey" json:"id"`
	Name  string         `gorm:"size:255;not null" json:"name"`
	Rank  int            `gorm:"default:1" json:"rank"`
	Links datatypes.JSON `json:"links" gorm:"jsonb"`
}

func (LeftMenuLink) TableName() string {
	return "left_menu_links"
}
