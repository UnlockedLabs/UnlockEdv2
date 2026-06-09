package models

type Tag struct {
	ID   uint   `gorm:"primaryKey" json:"key"`
	Name string `gorm:"size:255;not null" json:"value"`
}

func (Tag) TableName() string { return "tags" }

type OpenContentTag struct {
	TagID                 uint `gorm:"primaryKey" json:"tag_id"`
	ContentID             uint `gorm:"primaryKey" json:"content_id"`
	OpenContentProviderID uint `gorm:"primaryKey" json:"open_content_provider_id"`
}

func (OpenContentTag) TableName() string { return "open_content_tags" }
