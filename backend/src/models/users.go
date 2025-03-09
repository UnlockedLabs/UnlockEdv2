package models

import (
	"math/rand"
	"slices"
	"time"

	"gorm.io/gorm"
)

type UserRole string

const (
	SystemAdmin     UserRole = "system_admin"
	FacilityAdmin   UserRole = "facility_admin"
	DepartmentAdmin UserRole = "department_admin"
	Student         UserRole = "student"
)

var AdminRoles = []UserRole{SystemAdmin, FacilityAdmin, DepartmentAdmin}

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
	Role       UserRole `gorm:"size:64;default:student" json:"role" validate:"oneof=student system_admin facility_admin department_admin"`
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

type FAQClickMetric struct {
	UserID uint  `gorm:"not null" json:"user_id"`
	FAQID  uint  `gorm:"not null" json:"faq_id"`
	Total  int64 `gorm:"default:1" json:"total"`

	User *User `gorm:"foreignKey:UserID;references:ID" json:"-"`
	FAQ  *FAQ  `gorm:"foreignKey:FAQID;references:ID" json:"-"`
}

func (FAQClickMetric) TableName() string { return "faq_click_metrics" }

type FAQ struct {
	ID       uint   `gorm:"primaryKey" json:"-"`
	Question string `gorm:"size:255" json:"question"`
}

func (FAQ) TableName() string { return "faqs" }

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
