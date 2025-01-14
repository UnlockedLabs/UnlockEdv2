package database

import (
	"UnlockEdv2/src/models"
	"fmt"
	"strings"
)

type HelpfulLinkResp struct {
	models.HelpfulLink
	IsFavorited bool `json:"is_favorited"`
}

func (db *DB) GetHelpfulLinks(page, perPage int, search, orderBy string, onlyVisible bool, userID uint) (int64, []HelpfulLinkResp, error) {
	links := make([]HelpfulLinkResp, 0, perPage)

	subQuery := db.Table("open_content_favorites f").
		Select("1").
		Where("f.content_id = helpful_links.id AND f.user_id = ?", userID)
	tx := db.Model(&models.HelpfulLink{}).Select("helpful_links.*, EXISTS(?) as is_favorited", subQuery)
	var total int64

	if onlyVisible {
		tx = tx.Where("visibility_status = ?", true)
	}

	if search != "" {
		search = "%" + search + "%"
		tx = tx.Where("LOWER(title) LIKE ?", search)
	}
	switch strings.ToLower(orderBy) {
	case "most_popular":
		tx = tx.Order("COUNT(f.id) DESC")
	default:
		tx = tx.Order(orderBy)
	}

	if err := tx.Count(&total).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "helpful_links")
	}
	if err := tx.Offset(calcOffset(page, perPage)).Limit(perPage).Find(&links).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "helpful_links")
	}
	return total, links, nil
}

func (db *DB) AddHelpfulLink(link *models.HelpfulLink) error {
	if db.Where("url = ?", link.Url).First(&models.HelpfulLink{}).RowsAffected > 0 {
		return NewDBError(fmt.Errorf("link already exists"), "helpful_links")
	}
	if err := db.Create(link).Error; err != nil {
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

func (db *DB) GetLinkFromId(id uint) (*models.HelpfulLink, error) {
	var link models.HelpfulLink
	if err := db.Model(&models.HelpfulLink{}).Where("id = ?", id).First(&link).Error; err != nil {
		return nil, newGetRecordsDBError(err, "helpful_links")
	}
	return &link, nil
}

func (db *DB) GetHelpfulLinkOpenContentProviderId() (uint, error) {
	var provider models.OpenContentProvider
	if err := db.Model(&models.OpenContentProvider{}).Where("title = ?", "HelpfulLinks").First(&provider).Error; err != nil {
		return 0, newGetRecordsDBError(err, "open_content_providers")
	}
	return provider.ID, nil
}
