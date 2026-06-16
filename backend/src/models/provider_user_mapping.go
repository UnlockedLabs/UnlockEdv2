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

// CanvasMappedUser is a projection returned by database.GetCanvasMappedUsers,
// pairing a Canvas external_user_id with the matching local user fields.
type CanvasMappedUser struct {
	ExternalUserID string `gorm:"column:external_user_id"`
	UserID         uint   `gorm:"column:user_id"`
	NameFirst      string `gorm:"column:name_first"`
	NameLast       string `gorm:"column:name_last"`
	DocID          string `gorm:"column:doc_id"`
}

// MappedUserResponse is returned by the mapped-users endpoint.
// It embeds the local User and adds canvas display-name fields
// that are resolved live from the provider API (never stored in the DB).
type MappedUserResponse struct {
	User
	CanvasNameFirst string `json:"canvas_name_first"`
	CanvasNameLast  string `json:"canvas_name_last"`
}
