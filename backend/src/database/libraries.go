package database

import (
	"UnlockEdv2/src/models"
	"strings"

	log "github.com/sirupsen/logrus"
)

func (db *DB) GetAllLibraries(page, perPage int, showHidden bool, search string, providerId int) (int64, []models.Library, error) {
	var libraries []models.Library
	var total int64
	offset := (page - 1) * perPage
	tx := db.Model(&models.Library{})
	if !showHidden {
		tx = tx.Where("visibility_status = true")
	}
	if search != "" {
		search = "%" + strings.ToLower(search) + "%"
		tx = tx.Where("name LIKE ?", search)
	}
	if providerId != 0 {
		tx = tx.Where("open_content_provider_id = ?", providerId)
	}
	if err := tx.Count(&total).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "libraries")
	}
	if err := tx.Limit(perPage).Offset(offset).Find(&libraries).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "libraries")
	}
	return total, libraries, nil
}

func (db *DB) ToggleLibraryVisibility(id int) error {
	var library models.Library
	if err := db.Find(&library, "id = ?", id).Error; err != nil {
		log.Errorln("Unable to find library with that ID")
		return newNotFoundDBError(err, "libraries")
	}
	library.VisibilityStatus = !library.VisibilityStatus
	if err := db.Save(&library).Error; err != nil {
		return newUpdateDBError(err, "libraries")
	}
	return nil
}
