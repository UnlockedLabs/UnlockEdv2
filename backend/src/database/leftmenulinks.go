package database

import (
	"UnlockEdv2/src/models"

	log "github.com/sirupsen/logrus"
)

func (db *DB) GetLeftMenuLinks() ([]models.LeftMenuLink, error) {
	var links []models.LeftMenuLink
	if err := db.Conn.Find(&links).Error; err != nil {
		return nil, err
	}
	return links, nil
}

func (db *DB) DeleteAllLinks() error {
	db.Conn.Exec("DELETE FROM left_menu_links")
	return nil
}

func (db *DB) CreateFreshLeftMenuLinks(links []models.LeftMenuLink) error {
	if err := db.Conn.Create(&links).Error; err != nil {
		log.Errorf("Error creating links: %v", err)
		return err
	}
	log.Infof("Left-Menu-Links created")
	return nil
}

type UserCatalogueJoin struct {
	ProgramID    uint   `json:"program_id"`
	ThumbnailURL string `json:"thumbnail_url"`
	ProgramName  string `json:"program_name"`
	ProviderName string `json:"provider_name"`
	ExternalURL  string `json:"external_url"`
	ProgramType  string `json:"program_type"`
	IsFavorited  bool   `json:"is_favorited"`
	OutcomeTypes string `json:"outcome_types"`
}

func (db *DB) GetUserCatalogue(userId int, tags []string) ([]UserCatalogueJoin, error) {
	catalogue := []UserCatalogueJoin{}
	tx := db.Conn.Table("programs p").
		Select("p.id as program_id, p.thumbnail_url, p.name as program_name, pp.name as provider_name, p.external_url, p.type as program_type, p.outcome_types, f.user_id IS NOT NULL as is_favorited").
		Joins("LEFT JOIN provider_platforms pp ON p.provider_platform_id = pp.id").
		Joins("LEFT JOIN favorites f ON f.program_id = p.id AND f.user_id = ?", userId)
	for i, tag := range tags {
		if i == 0 {
			tx.Where("p.outcome_types ILIKE ?", "%"+tag+"%")
		} else {
			tx.Or("p.outcome_types ILIKE ?", "%"+tag+"%")
		}
		tx.Or("p.type ILIKE ?", "%"+tag+"%")
	}
	err := tx.Scan(&catalogue).Error
	if err != nil {
		return nil, err
	}
	return catalogue, nil
}
