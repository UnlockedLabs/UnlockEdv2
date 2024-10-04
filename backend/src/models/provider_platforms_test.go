package models

import (
	"os"
	"testing"

	_ "github.com/ncruces/go-sqlite3/embed"
	"github.com/ncruces/go-sqlite3/gormlite"
	"github.com/stretchr/testify/assert"
	"gorm.io/gorm"
)

func setupTestDB() (*gorm.DB, error) {
	gormDb, err := gorm.Open(gormlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		return nil, err
	}
	err = gormDb.AutoMigrate(&ProviderPlatform{})
	return gormDb, err
}

func TestEncryptAccessKeyOnSave(t *testing.T) {
	os.Setenv("APP_KEY", "test_secret_key")
	db, err := setupTestDB()
	assert.NoError(t, err)
	provider := ProviderPlatform{
		Type:      CanvasOSS,
		Name:      "Test Platform",
		AccountID: "12345",
		AccessKey: "original_access_key",
		BaseUrl:   "http://example.com",
		State:     Enabled,
	}
	err = db.Create(&provider).Error
	assert.NoError(t, err)
	assert.NotEqual(t, "original_access_key", provider.AccessKey)
	var fetched ProviderPlatform

	err = db.First(&fetched, "id = ?", provider.ID).Error
	assert.NoError(t, err)
	assert.Equal(t, "original_access_key", fetched.AccessKey)
}

func TestAccessKeyUpdate(t *testing.T) {
	os.Setenv("APP_KEY", "test_secret_key")

	db, err := setupTestDB()
	assert.NoError(t, err)

	provider := ProviderPlatform{
		Type:      CanvasOSS,
		Name:      "Test Platform",
		AccountID: "12345",
		AccessKey: "first_key",
		BaseUrl:   "http://example.com",
		State:     Enabled,
	}

	err = db.Create(&provider).Error
	assert.NoError(t, err)
	provider.AccessKey = "updated_key"
	err = db.Save(&provider).Error
	assert.NoError(t, err)

	var fetchedProvider ProviderPlatform
	err = db.First(&fetchedProvider, "id = ?", provider.ID).Error
	assert.NoError(t, err)
	assert.Equal(t, "updated_key", fetchedProvider.AccessKey)
}

func TestAccessKeyNotUpdatedWhenUnchanged(t *testing.T) {
	os.Setenv("APP_KEY", "test_secret_key")
	db, err := setupTestDB()
	assert.NoError(t, err)

	provider := ProviderPlatform{
		Type:      CanvasOSS,
		Name:      "Test Platform",
		AccountID: "12345",
		AccessKey: "unchanged_key",
		BaseUrl:   "http://example.com",
		State:     Enabled,
	}

	err = db.Create(&provider).Error
	assert.NoError(t, err)

	originalEncryptedKey := provider.AccessKey

	provider.Name = "Updated Platform"
	err = db.Save(&provider).Error
	assert.NoError(t, err)

	assert.Equal(t, originalEncryptedKey, provider.AccessKey)
}
