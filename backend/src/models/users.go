package models

import (
	"math/rand"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type UserRole string

const (
	Admin   UserRole = "admin"
	Student UserRole = "student"
)

type DatabaseFields struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type User struct {
	DatabaseFields
	Username      string   `gorm:"size:255;not null;unique" json:"username" validate:"alphanum"`
	NameFirst     string   `gorm:"size:255;not null" json:"name_first"`
	Email         string   `gorm:"size:255;not null;unique" json:"email"`
	Password      string   `gorm:"size:255;not null" json:"-"`
	PasswordReset bool     `gorm:"default:true" json:"password_reset"`
	NameLast      string   `gorm:"size:255;not null" json:"name_last"`
	Role          UserRole `gorm:"size:255;default:student" json:"role"`
	KratosID      string   `gorm:"size:255" json:"kratos_id"`
	FacilityID    uint     `json:"facility_id"`

	/* foreign keys */
	Mappings    []ProviderUserMapping `json:"-"`
	ActivityLog []UserActivity        `json:"-"`
	Facility    *Facility             `gorm:"foreignKey:FacilityID;constraint:OnDelete SET NULL" json:"-"`
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

func (user *User) HashPassword() error {
	bytes, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	user.Password = string(bytes)
	return nil
}

func (user *User) GetExternalIDFromProvider(db *gorm.DB, providerId uint) (string, error) {
	var mapping ProviderUserMapping
	err := db.Model(ProviderUserMapping{}).Where("provider_platform_id = ?", providerId).Where("user_id = ?", user.ID).Find(&mapping).Error
	if err != nil {
		return "", err
	}
	return mapping.ExternalUserID, nil
}

/**
* This function is called on a user object when it's fresh out of the database, so
* the password is already hashed and checked against the input string
**/
func (user *User) CheckPasswordHash(password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)) == nil
}
