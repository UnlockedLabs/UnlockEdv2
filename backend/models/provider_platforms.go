package models

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"io"
	"os"
	"time"

	"gorm.io/gorm"
)

type ProviderPlatform struct {
	ID                     int            `gorm:"primaryKey" json:"id"`
	Type                   string         `gorm:"size:100" json:"type"`
	Name                   string         `gorm:"size:255" json:"name"`
	Description            string         `gorm:"size:1024" json:"description"`
	IconUrl                string         `gorm:"size:255" json:"icon_url"`
	AccountId              string         `gorm:"size:36" json:"account_id"`
	AccessKey              string         `gorm:"size:255" json:"access_key"`
	BaseUrl                string         `gorm:"size:255" json:"base_url"`
	State                  string         `gorm:"size:100" json:"state"`
	ExternalAuthProviderId string         `gorm:"size:36" json:"external_auth_provider_id"`
	CreatedAt              time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"created_at"`
	UpdatedAt              time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"updated_at"`
	DeletedAt              gorm.DeletedAt `gorm:"index" json:"-"`
}

func (ProviderPlatform) TableName() string {
	return "provider_platforms"
}

func (provider *ProviderPlatform) EncryptAccessKey() (string, error) {
	key := os.Getenv("APP_KEY")
	hashedKey := sha256.Sum256([]byte(key))
	block, err := aes.NewCipher(hashedKey[:])
	if err != nil {
		return "", err
	}
	ciphertext := make([]byte, aes.BlockSize+len(provider.AccessKey))
	iv := ciphertext[:aes.BlockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", err
	}
	stream := cipher.NewCFBEncrypter(block, iv)
	stream.XORKeyStream(ciphertext[aes.BlockSize:], []byte(provider.AccessKey))
	encoded := base64.StdEncoding.EncodeToString(ciphertext)
	return encoded, nil
}
