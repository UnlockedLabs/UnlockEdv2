package models

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"io"
	"os"
)

type ProviderPlatform struct {
	ID                     string `json:"id"`
	Type                   string `json:"type"`
	Name                   string `json:"name"`
	Description            string `json:"description"`
	IconUrl                string `json:"icon_url"`
	AccountId              string `json:"account_id"`
	AccessKey              string `json:"access_key"`
	BaseUrl                string `json:"base_url"`
	State                  string `json:"state"`
	ExternalAuthProviderId string `json:"external_auth_provider_id"`
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
