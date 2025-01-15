package models

import (
	"math/rand"
	"slices"
	"time"

	"gorm.io/gorm"
)

type UserRole string

const (
	SystemAdmin UserRole = "system_admin"
	Admin       UserRole = "admin"
	Student     UserRole = "student"
)

var AdminRoles = []UserRole{SystemAdmin, Admin}

type DatabaseFields struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type Role struct {
	Name UserRole `json:"name" gorm:"primaryKey"`
}

type User struct {
	DatabaseFields
	Username   string   `gorm:"size:255;not null;unique" json:"username" validate:"alphanumunicode"`
	NameFirst  string   `gorm:"size:255;not null" json:"name_first"  validate:"alphanumspace"`
	Email      string   `gorm:"size:255;not null;unique" json:"email" validate:"-"`
	NameLast   string   `gorm:"size:255;not null" json:"name_last"  validate:"alphanumspace"`
	Role       UserRole `gorm:"size:64;default:student" json:"role" validate:"oneof=admin student system_admin"`
	KratosID   string   `gorm:"size:255" json:"kratos_id"`
	FacilityID uint     `json:"facility_id"`

	/* foreign keys */
	Mappings             []ProviderUserMapping `json:"mappings,omitempty" gorm:"foreignKey:UserID;constraint:OnDelete CASCADE"`
	Enrollments          []UserEnrollment      `json:"enrollments,omitempty" gorm:"foreignKey:UserID;constraint:OnDelete CASCADE"`
	OpenContentFavorites []OpenContentFavorite `json:"favorites,omitempty" gorm:"foreignKey:UserID;constraint:OnDelete CASCADE"`
	Facility             *Facility             `json:"facility,omitempty" gorm:"foreignKey:FacilityID;constraint:OnDelete SET NULL"`
	UserRole             *Role                 `json:"-" gorm:"foreignKey:Role;constraint:OnDelete SET NULL"`
	LoginCount           *LoginMetrics         `json:"login_count,omitempty" gorm:"foreignKey:UserID;constraint:OnDelete CASCADE"`
}

type ImportUser struct {
	Username         string `json:"username"`
	NameFirst        string `json:"name_first"`
	NameLast         string `json:"name_last"`
	Email            string `json:"email"`
	ExternalUserID   string `json:"external_user_id"`
	ExternalUsername string `json:"external_username"`
}

func (User) TableName() string {
	return "users"
}

func (usr *User) BeforeCreate(tx *gorm.DB) error {
	if usr.Email == "" {
		usr.Email = usr.Username + "@unlocked.v2"
	}
	return nil
}

const letterBytes = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

func (user *User) CreateTempPassword() string {
	b := make([]byte, 8)
	for i := range b {
		b[i] = letterBytes[rand.Intn(len(letterBytes))]
	}
	return string(b)
}

func (user *User) GetTraits() map[string]interface{} {
	return map[string]interface{}{
		"username":    user.Username,
		"role":        user.Role,
		"facility_id": user.FacilityID,
	}
}

func (user *User) IsAdmin() bool {
	return slices.Contains(AdminRoles, user.Role)
}
