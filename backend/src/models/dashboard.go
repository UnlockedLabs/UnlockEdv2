package models

import (
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type LeftMenuLink struct {
	ID    int            `gorm:"primaryKey" json:"-"`
	Name  string         `gorm:"size:255;not null" json:"name"`
	Rank  int            `gorm:"default:1" json:"rank"`
	Links datatypes.JSON `json:"links" gorm:"jsonb"`
}

func (link *LeftMenuLink) BeforeCreate(tx *gorm.DB) error {
	link.ID = 0
	return nil
}

func (LeftMenuLink) TableName() string {
	return "left_menu_links"
}

type UserFavorite struct {
	ID        uint `gorm:"primaryKey" json:"-"`
	UserID    uint `json:"user_id"`
	ProgramID uint `json:"program_id"`
}

func (UserFavorite) TableName() string {
	return "favorites"
}
