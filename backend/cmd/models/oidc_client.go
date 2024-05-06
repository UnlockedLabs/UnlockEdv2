package models

type OidcClient struct {
	DatabaseFields
	ProviderPlatformID uint   `json:"provider_platform_id"`
	ClientID           string `gorm:"size:255" json:"client_id"`
	ClientName         string `gorm:"size:255" json:"client_name"`
	ClientSecret       string `gorm:"size:255" json:"client_secret"`
	RedirectURIs       string `gorm:"size:255" json:"redirect_uris"`
	Scopes             string `gorm:"size:255" json:"scopes"`

	Provider *ProviderPlatform `gorm:"foreignKey:ProviderPlatformID" json:"-"`
}

func (OidcClient) TableName() string {
	return "oidc_clients"
}
