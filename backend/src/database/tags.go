package database

import "UnlockEdv2/src/models"

func (db *DB) GetTags() ([]models.Tag, error) {
	var tags []models.Tag
	if err := db.Model(&models.Tag{}).Find(&tags).Error; err != nil {
		return nil, newNotFoundDBError(err, "tags")
	}
	return tags, nil
}
