package models

type AuthProviderStatus string

const (
	OpenIDConnect AuthProviderStatus = "openid_connect"
	Oauth2        AuthProviderStatus = "oauth2"
	None          AuthProviderStatus = "none"
)

type ProviderUserMapping struct {
	DatabaseFields
	UserID                       uint               `gorm:"not null" json:"user_id"`
	ProviderPlatformID           uint               `gorm:"not null" json:"provider_platform_id"`
	ExternalUserID               string             `gorm:"size:255;not null" json:"external_user_id"`
	ExternalUsername             string             `gorm:"size:255;not null" json:"external_username"`
	AuthenticationProviderStatus AuthProviderStatus `gorm:"size:255;not null;default:none" json:"authentication_provider_status"`
	ExternalLoginID              string             `gorm:"size:255" json:"external_login_id"`
	/*    Relations    */
	User             *User             `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
	ProviderPlatform *ProviderPlatform `gorm:"foreignKey:ProviderPlatformID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
}

func (ProviderUserMapping) TableName() string {
	return "provider_user_mappings"
}
