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
	if err := db.Model(&models.ProviderPlatform{}).Preload("OidcClient").
		Offset(offset).Limit(perPage).Find(&platforms).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "provider_platforms")
	}
	toReturn := iterMap(func(prov models.ProviderPlatform) models.ProviderPlatform {
		if prov.OidcClient != nil {
			prov.OidcID = prov.OidcClient.ID
		}
		return prov
	}, platforms)

	return total, toReturn, nil
}

func iterMap[T any](fun func(T) T, arr []T) []T {
	applied := []T{}
	for _, item := range arr {
		applied = append(applied, fun(item))
	}
	return applied
}

func (db *DB) GetAllActiveProviderPlatforms() ([]models.ProviderPlatform, error) {
	var platforms []models.ProviderPlatform
	if err := db.Model(models.ProviderPlatform{}).Preload("OidcClient").
		Find(&platforms, "state = ?", "enabled").Error; err != nil {
		return nil, newGetRecordsDBError(err, "provider_platforms")
	}

	toReturn := iterMap(func(prov models.ProviderPlatform) models.ProviderPlatform {
		if prov.OidcClient != nil {
			prov.OidcID = prov.OidcClient.ID
		}
		return prov
	}, platforms)
	return toReturn, nil
}

func (db *DB) GetProviderPlatformByID(id int) (*models.ProviderPlatform, error) {
	var platform models.ProviderPlatform
	if err := db.Model(models.ProviderPlatform{}).Preload("OidcClient").
		Find(&platform, "id = ?", id).Error; err != nil {
		return nil, newNotFoundDBError(err, "provider_platforms")
	}
	if platform.OidcClient != nil {
		platform.OidcID = platform.OidcClient.ID
	}
	return &platform, nil
}

func (db *DB) CreateProviderPlatform(platform *models.ProviderPlatform) error {
	if key, err := models.EncryptAccessKey(platform.AccessKey); err == nil {
		platform.AccessKey = key
	}
	if err := db.Create(platform).Error; err != nil {
		return newCreateDBError(err, "provider_platforms")
	}
	if platform.Type == models.Kolibri {
		contentProv := models.OpenContentProvider{
			BaseUrl:            platform.BaseUrl,
			ProviderPlatformID: &platform.ID,
			CurrentlyEnabled:   true,
			Description:        models.KolibriDescription,
			Thumbnail:          models.KolibriThumbnailUrl,
		}
		if err := db.Create(&contentProv).Error; err != nil {
			log.Errorln("unable to create relevant content provider for new kolibri instance")
		}
	}
	return nil
}

func (db *DB) UpdateProviderPlatform(platform *models.ProviderPlatform, id uint) (*models.ProviderPlatform, error) {
	log.Printf("Updating provider platform with ID: %d", id)
	var existingPlatform models.ProviderPlatform
	if err := db.First(&existingPlatform, id).Error; err != nil {
		return nil, newUpdateDBError(err, "provider_platforms")
	}
	// at this point, they are both decrypted
	if platform.AccessKey != "" && existingPlatform.AccessKey != platform.AccessKey {
		if key, err := models.EncryptAccessKey(platform.AccessKey); err == nil {
			platform.AccessKey = key
		}
	}
	models.UpdateStruct(&existingPlatform, platform)
	if err := db.Save(&existingPlatform).Error; err != nil {
		return nil, newUpdateDBError(err, "provider_platforms")
	}
	return &existingPlatform, nil
}

func (db *DB) DeleteProviderPlatform(id int) error {
	log.Printf("Deleting provider platform with ID: %d", id)
	if err := db.Delete(&models.ProviderPlatform{}, fmt.Sprintf("%d", id)).Error; err != nil {
		return newDeleteDBError(err, "provider_platforms")
	}
	return nil
}
