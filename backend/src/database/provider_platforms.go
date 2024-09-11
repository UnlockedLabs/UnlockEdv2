package database

import (
	"UnlockEdv2/src/models"
	"fmt"

	log "github.com/sirupsen/logrus"
)

func (db *DB) GetAllProviderPlatforms(page, perPage int) (int64, []models.ProviderPlatform, error) {
	var platforms []models.ProviderPlatform
	var total int64
	offset := (page - 1) * perPage
	if err := db.Model(&models.ProviderPlatform{}).Offset(offset).Limit(perPage).Find(&platforms).Error; err != nil {
		return 0, nil, err
	}
	return total, platforms, nil
}

func (db *DB) GetAllActiveProviderPlatforms() ([]models.ProviderPlatform, error) {
	var platforms []models.ProviderPlatform
	if err := db.Model(models.ProviderPlatform{}).Find(&platforms, "state = ?", "active").Error; err != nil {
		return nil, err
	}
	return platforms, nil
}

func (db *DB) GetProviderPlatformByID(id int) (*models.ProviderPlatform, error) {
	var platform models.ProviderPlatform
	if err := db.Model(models.ProviderPlatform{}).Find(&platform, "id = ?", id).Error; err != nil {
		return nil, NewDBError(err, "platform not found")
	}
	key, err := platform.DecryptAccessKey()
	if err != nil {
		return nil, NewDBError(err, "platform not found")
	}
	platform.AccessKey = key
	return &platform, nil
}

func (db *DB) CreateProviderPlatform(platform *models.ProviderPlatform) (*models.ProviderPlatform, error) {
	key, err := platform.EncryptAccessKey()
	if err != nil {
		log.Printf("Error encrypting access key: %v", err)
		return nil, err
	}
	platform.AccessKey = key
	log.Printf("Creating provider platform: %v", platform)
	if err := db.Create(&platform).Error; err != nil {
		return nil, err
	}
	if platform.Type == models.Kolibri {
		contentProv := models.OpenContentProvider{
			Url:                platform.BaseUrl,
			Thumbnail:          platform.IconUrl,
			ProviderPlatformID: platform.ID,
			CurrentlyEnabled:   true,
			Description:        models.KolibriDescription,
		}
		if err := db.Create(&contentProv).Error; err != nil {
			log.Errorln("unable to create relevant content provider for new kolibri instance")
		}
	}
	newProv := models.ProviderPlatform{}
	if err := db.Find(&newProv, "id = ?", platform.ID).Error; err != nil {
		return nil, err
	}
	return &newProv, nil
}

func (db *DB) UpdateProviderPlatform(platform *models.ProviderPlatform, id uint) (*models.ProviderPlatform, error) {
	log.Printf("Updating provider platform with ID: %d", id)
	var existingPlatform models.ProviderPlatform
	if err := db.First(&existingPlatform, id).Error; err != nil {
		return nil, err
	}
	models.UpdateStruct(&existingPlatform, platform)
	if platform.AccessKey != "" {
		key, err := platform.EncryptAccessKey()
		if err != nil {
			log.Printf("Error encrypting access key: %v", err)
			return nil, err
		}
		existingPlatform.AccessKey = key
	}
	if platform.State != "" {
		existingPlatform.State = platform.State
	}
	if err := db.Save(&existingPlatform).Error; err != nil {
		return nil, err
	}
	return &existingPlatform, nil
}

func (db *DB) DeleteProviderPlatform(id int) error {
	log.Printf("Deleting provider platform with ID: %d", id)
	if err := db.Delete(&models.ProviderPlatform{}, fmt.Sprintf("%d", id)).Error; err != nil {
		return err
	}
	return nil
}
