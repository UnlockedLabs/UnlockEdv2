package database

import (
	"UnlockEdv2/src/models"

	log "github.com/sirupsen/logrus"
)

func (db *DB) GetOpenContent(all bool) ([]models.OpenContentProvider, error) {
	var content []models.OpenContentProvider
	tx := db.Model(&models.OpenContentProvider{})
	if !all {
		tx.Where("currently_enabled = true")
	}
	if err := tx.Find(&content).Error; err != nil {
		return nil, newGetRecordsDBError(err, "open_content_providers")
	}
	return content, nil
}

func (db *DB) ToggleContentProvider(id int) error {
	var provider models.OpenContentProvider
	if err := db.Find(&provider, "id = ?", id).Error; err != nil {
		log.Errorln("unable to find conent provider with that ID")
		return newNotFoundDBError(err, "open_content_providers")
	}
	provider.CurrentlyEnabled = !provider.CurrentlyEnabled
	if err := db.Save(&provider).Error; err != nil {
		return newUpdateDBrror(err, "open_content_providers")
	}
	return nil
}

func (db *DB) CreateContentProvider(url, thumbnail, description string, id int) error {
	provider := models.OpenContentProvider{
		Url:         url,
		Thumbnail:   thumbnail,
		Description: description,
	}
	if id != 0 {
		provider.ProviderPlatformID = uint(id)
	}
	if err := db.Create(&provider).Error; err != nil {
		return newCreateDBError(err, "open_content_providers")
	}
	return nil
}

func (db *DB) FindKolibriInstance() (*models.ProviderPlatform, error) {
	kolibri := models.ProviderPlatform{}
	if err := db.First(&kolibri, "type = ?", "kolibri").Error; err != nil {
		log.Error("error getting kolibri provider platform")
		return nil, newNotFoundDBError(err, "provider_platforms")
	}
	return &kolibri, nil
}
