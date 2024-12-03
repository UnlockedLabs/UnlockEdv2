package models

import (
	"gorm.io/gorm"
)

type HelpfulLink struct {
	DatabaseFields
	Title                 string `gorm:"size:255;not null" json:"title"`
	Description           string `gorm:"size:255;not null" json:"description"`
	Url                   string `gorm:"size:255;not null" json:"url"`
	VisibilityStatus      bool   `gorm:"default:true" json:"visibility_status"`
	OpenContentProviderID uint   `json:"open_content_provider_id"`
	FacilityID            uint   `json:"facility_id"`
}

func (HelpfulLink) TableName() string {
	return "helpful_links"
}
func (hl *HelpfulLink) BeforeCreate(tx *gorm.DB) error {
	var id int
	if hl.OpenContentProviderID == 0 {
		if err := tx.Table("open_content_providers").Select("id").Where("name = ? ", HelpfulLinks).Scan(&id).Error; err != nil {
			return err
		}
		hl.OpenContentProviderID = uint(id)
	}
	return nil
}

type ProgramFavorite struct {
	ID        uint `gorm:"primaryKey" json:"-"`
	UserID    uint `json:"user_id"`
	ProgramID uint `json:"program_id"`

	User    *User    `json:"user,omitempty" gorm:"foreignKey:UserID;constraint:OnDelete CASCADE"`
	Program *Program `json:"program,omitempty" gorm:"foreignKey:ProgramID;constraint:OnDelete CASCADE"`
}

func (ProgramFavorite) TableName() string {
	return "program_favorites"
}
