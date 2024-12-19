package models

type Library struct {
	DatabaseFields
	OpenContentProviderID uint    `gorm:"not null" json:"open_content_provider_id"`
	ExternalID            *string `json:"external_id"`
	Title                 string  `gorm:"size:255;not null" json:"title"`
	Language              *string `gorm:"size:255" json:"language"`
	Description           *string `json:"description"`
	Url                   string  `gorm:"not null" json:"url"`
	ThumbnailUrl          *string `json:"thumbnail_url"`
	VisibilityStatus      bool    `gorm:"default:false;not null" json:"visibility_status"`

	OpenContentProvider *OpenContentProvider  `gorm:"foreignKey:OpenContentProviderID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"open_content_provider"`
	Favorites           []OpenContentFavorite `gorm:"-" json:"favorites"`
}

func (Library) TableName() string { return "libraries" }

func (lib *Library) IntoProxyPO() *LibraryProxyPO {
	proxyParams := LibraryProxyPO{
		ID:                    lib.ID,
		Path:                  lib.Url,
		BaseUrl:               lib.OpenContentProvider.Url,
		OpenContentProviderID: lib.OpenContentProvider.ID,
		VisibilityStatus:      lib.VisibilityStatus,
	}
	return &proxyParams
}

type LibraryProxyPO struct {
	ID                    uint
	OpenContentProviderID uint
	Path                  string
	BaseUrl               string
	VisibilityStatus      bool
}
