package models

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
