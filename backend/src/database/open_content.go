package database

import (
	"UnlockEdv2/src/models"

	log "github.com/sirupsen/logrus"
)

func (db *DB) GetOpenContent(all bool) ([]models.OpenContentProvider, error) {
	var content []models.OpenContentProvider
	tx := db.Conn.Model(&models.OpenContentProvider{})
	if !all {
		tx.Where("currently_enabled = true")
	}
	return content, tx.Find(&content).Error
}

func (db *DB) ToggleContentProvider(id int) error {
	var provider models.OpenContentProvider
	if err := db.Conn.Find(&provider, "id = ?", id).Error; err != nil {
		log.Errorln("unable to find conent provider with that ID")
		return err
	}
	provider.CurrentlyEnabled = !provider.CurrentlyEnabled
	return db.Conn.Save(&provider).Error
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
	return db.Conn.Create(&provider).Error
}
