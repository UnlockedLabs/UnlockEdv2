package database

import (
	"UnlockEdv2/src/models"
	"fmt"
)

func (db *DB) GetHelpfulLinks(page, perPage int, search, orderBy string) (int64, []models.HelpfulLink, error) {
	var links []models.HelpfulLink
	tx := db.Model(&models.HelpfulLink{})
	var total int64

	validOrder := map[string]bool{
		"title ASC":       true,
		"title DESC":      true,
		"created_at ASC":  true,
		"created_at DESC": true,
	}

	if search != "" {
		search = "%" + search + "%"
		tx = tx.Where("LOWER(title) LIKE ?", search)
	}

	if valid, ok := validOrder[orderBy]; ok && valid {
		tx = tx.Order(orderBy)
	} else {
		tx = tx.Order("created_at DESC")
	}

	if err := tx.Count(&total).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "helpful_links")
	}

	offset := (page - 1) * perPage
	if err := tx.Offset(offset).Limit(perPage).Find(&links).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "helpful_links")
	}

	return total, links, nil
}
func (db *DB) AddHelpfulLink(link models.HelpfulLink) error {
	if db.Where("url = ?", link.Url).First(&models.HelpfulLink{}).RowsAffected > 0 {
		return NewDBError(fmt.Errorf("Link already exists"), "helpful_links")
	}
	if err := db.Create(&link).Error; err != nil {
		return newCreateDBError(err, "helpful_links")
	}
	return nil
}

func (db *DB) DeleteLink(id uint) error {
	var link models.HelpfulLink
	if err := db.Model(&models.HelpfulLink{}).Where("id = ?", id).First(&link).Error; err != nil {
		return newGetRecordsDBError(err, "helpful_links")
	}
	if err := db.Unscoped().Delete(&link).Error; err != nil {
		return newDeleteDBError(err, "helpful_links")
	}
	return nil
}

func (db *DB) EditLink(id uint, link models.HelpfulLink) error {
	if err := db.Model(&models.HelpfulLink{}).Where("id = ?", id).Updates(link).Error; err != nil {
		return newUpdateDBError(err, "helpful_links")
	}
	return nil
}

func (db *DB) ToggleVisibilityStatus(id int) error {
	var link models.HelpfulLink
	if err := db.Model(&models.HelpfulLink{}).Where("id = ?", id).First(&link).Error; err != nil {
		return newGetRecordsDBError(err, "helpful_links")
	}
	link.VisibilityStatus = !link.VisibilityStatus
	if err := db.Save(&link).Error; err != nil {
		return newUpdateDBError(err, "helpful_links")
	}
	return nil
}
