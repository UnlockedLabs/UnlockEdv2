package models

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"strings"

	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type ProviderPlatformType string

const (
	CanvasOSS   ProviderPlatformType = "canvas_oss"
	CanvasCloud ProviderPlatformType = "canvas_cloud"
	Kolibri     ProviderPlatformType = "kolibri"
	Brightspace ProviderPlatformType = "brightspace"
)

type ProviderPlatformState string

const (
	Enabled   ProviderPlatformState = "enabled"
	Disabled  ProviderPlatformState = "disabled"
	Archived  ProviderPlatformState = "archived"
	UuidV4Len                       = 32
)

type ProviderPlatform struct {
	DatabaseFields
	Type                   ProviderPlatformType  `gorm:"size:100"  json:"type"`
	Name                   string                `gorm:"size:255"  json:"name"`
	AccountID              string                `gorm:"size:64"   json:"account_id"`
	AccessKey              string                `gorm:"size:255"  json:"access_key"`
	BaseUrl                string                `gorm:"size:255"  json:"base_url"`
	State                  ProviderPlatformState `gorm:"size:100"  json:"state"`
	ExternalAuthProviderId string                `gorm:"size:128"  json:"external_auth_provider_id"`
	/* this field needs to be fetched by joining oidc_clients when querying the provider_platforms */
	OidcID uint `gorm:"-"         json:"oidc_id"`

	Courses              []Course              `gorm:"foreignKey:ProviderPlatformID;references:ID" json:"-"`
	ProviderUserMappings []ProviderUserMapping `gorm:"foreignKey:ProviderPlatformID;references:ID" json:"-"`
	OidcClient           *OidcClient           `gorm:"foreignKey:ProviderPlatformID;references:ID" json:"-"`
	Tasks                []RunnableTask        `gorm:"foreignKey:ProviderPlatformID;references:ID" json:"-"`
}

func (ProviderPlatform) TableName() string {
	return "provider_platforms"
}

func (provider *ProviderPlatform) BeforeCreate(tx *gorm.DB) (err error) {
	if provider.Type == Kolibri && !strings.Contains(provider.AccountID, "-") && len(provider.AccountID) == UuidV4Len {
		// convert the uuid back into hypenated format
		provider.AccountID = fmt.Sprintf("%s-%s-%s-%s-%s", provider.AccountID[0:8], provider.AccountID[8:12], provider.AccountID[12:16], provider.AccountID[16:20], provider.AccountID[20:])
	}
	return nil
}

func (provider *ProviderPlatform) AfterFind(tx *gorm.DB) (err error) {
	if key, keyErr := DecryptAccessKey(provider.AccessKey); keyErr == nil {
		provider.AccessKey = key
	}
	return nil
}

func DecryptAccessKey(axxKey string) (string, error) {
	key := os.Getenv("APP_KEY")
	hashedKey := sha256.Sum256([]byte(key))
	block, err := aes.NewCipher(hashedKey[:])
	if err != nil {
		return "", err
	}
	ciphertext, err := base64.StdEncoding.DecodeString(axxKey)
	if err != nil {
		return "", err
	}
	if len(ciphertext) < aes.BlockSize {
		return "", err
	}
	iv := ciphertext[:aes.BlockSize]
	ciphertext = ciphertext[aes.BlockSize:]
	stream := cipher.NewCFBDecrypter(block, iv)
	stream.XORKeyStream(ciphertext, ciphertext)
	return string(ciphertext), nil
}

func EncryptAccessKey(apiKey string) (string, error) {
	key := os.Getenv("APP_KEY")
	hashedKey := sha256.Sum256([]byte(key))
	block, err := aes.NewCipher(hashedKey[:])
	if err != nil {
		return "", err
	}
	ciphertext := make([]byte, aes.BlockSize+len(apiKey))
	iv := ciphertext[:aes.BlockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", err
	}
	stream := cipher.NewCFBEncrypter(block, iv)
	stream.XORKeyStream(ciphertext[aes.BlockSize:], []byte(apiKey))
	encoded := base64.StdEncoding.EncodeToString(ciphertext)
	return encoded, nil
}

func (provider *ProviderPlatform) GetDefaultRedirectURI() []string {
	switch provider.Type {
	case CanvasOSS, CanvasCloud:
		return []string{provider.BaseUrl + "/login/oauth2/callback"}

	case Kolibri:
		defaultUri := provider.BaseUrl + "/oidccallback/"
		stripped := strings.Replace(defaultUri, "https", "http", 1)
		return []string{defaultUri, stripped}
	}
	return []string{}
}

func (prov *ProviderPlatform) GetDefaultCronJobs() []JobType {
	jobs := []JobType{}
	// at some point these may differ per provider, for now they all return the default jobs
	for _, job := range AllDefaultProviderJobs {
		jobs = append(jobs, job)
		log.WithFields(log.Fields{"job": job, "provider": prov.Name}).Info("Job added for provider")
	}
	return jobs
}
