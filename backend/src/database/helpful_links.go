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

func (db *DB) GetHelpfulLinks(args *models.QueryContext, onlyVisible bool) ([]HelpfulLinkResp, error) {
	links := make([]HelpfulLinkResp, 0, args.PerPage)

	subQuery := db.Table("open_content_favorites f").
		Select("1").
		Where(`f.content_id = helpful_links.id AND f.user_id = ?
			AND f.open_content_provider_id = helpful_links.open_content_provider_id`, args.UserID)
	tx := db.Model(&models.HelpfulLink{}).Select("helpful_links.*, EXISTS(?) as is_favorited", subQuery)

	if onlyVisible {
		tx = tx.Where("visibility_status = ?", true)
	}

	tx = tx.Where("helpful_links.facility_id = ?", args.FacilityID)

	if args.Search != "" {
		tx.Where("LOWER(title) LIKE ?", args.SearchQuery())
	}
	switch strings.ToLower(args.OrderBy) {
	case "most_popular":
		tx = tx.Joins("LEFT JOIN open_content_favorites f ON f.content_id = helpful_links.id AND f.open_content_provider_id = helpful_links.open_content_provider_id").
			Group("helpful_links.id").Order("COUNT(f.id) DESC")
	default:
		tx = tx.Order(args.OrderClause("helpful_links.created_at desc"))
	}

	if err := tx.Count(&args.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "helpful_links")
	}
	if err := tx.Offset(args.CalcOffset()).Limit(args.PerPage).Find(&links).Error; err != nil {
		return nil, newGetRecordsDBError(err, "helpful_links")
	}
	return links, nil
}

func (db *DB) AddHelpfulLink(link *models.HelpfulLink) error {
	if db.Where("facility_id = ? and url = ?", link.FacilityID, link.Url).First(&models.HelpfulLink{}).RowsAffected > 0 {
		return NewDBError(fmt.Errorf("link already exists"), "existing_helpful_link")
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
