package models

import (
	"time"

	"gorm.io/gorm"
)

type AuthProviderStatus string

const (
	OpenIDConnect AuthProviderStatus = "openid_connect"
	Oauth2        AuthProviderStatus = "oauth2"
	None          AuthProviderStatus = "none"
)

type ProviderUserMapping struct {
	ID                           int                `gorm:"primaryKey" json:"id"`
	UserID                       int                `gorm:"not null" json:"user_id"`
	ProviderPlatformID           int                `gorm:"not null" json:"provider_platform_id"`
	ExternalUserID               string             `gorm:"size:255;not null" json:"external_user_id"`
	ExternalUsername             string             `gorm:"size:255;not null" json:"external_username"`
	AuthenticationProviderStatus AuthProviderStatus `gorm:"size:255;not null;default:none" json:"authentication_provider_status"`
	ExternalLoginID              string             `gorm:"size:255" json:"external_login_id"`
	CreatedAt                    time.Time          `gorm:"type:timestamp;default:current_timestamp" json:"created_at"`
	UpdatedAt                    time.Time          `gorm:"type:timestamp;default:current_timestamp" json:"updated_at"`
	DeletedAt                    gorm.DeletedAt     `gorm:"index" json:"-"`
	/*    Relations    */
	User             User             `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
	ProviderPlatform ProviderPlatform `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
}

func (ProviderUserMapping) TableName() string {
	return "provider_user_mappings"
}
