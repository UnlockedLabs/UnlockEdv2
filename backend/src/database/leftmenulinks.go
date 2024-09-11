package database

import (
	"UnlockEdv2/src/models"

	log "github.com/sirupsen/logrus"
)

func (db *DB) GetLeftMenuLinks() ([]models.LeftMenuLink, error) {
	var links []models.LeftMenuLink
	if err := db.Find(&links).Error; err != nil {
		return nil, newGetRecordsDBError(err, "left_menu_links")
	}
	return links, nil
}

func (db *DB) DeleteAllLinks() error {
	if err := db.Exec("DELETE FROM left_menu_links").Error; err != nil {
		return newDeleteDBError(err, "left_menu_links")
	}
	return nil
}

func (db *DB) CreateFreshLeftMenuLinks(links []models.LeftMenuLink) error {
	if err := db.Create(&links).Error; err != nil {
		log.Errorf("Error creating links: %v", err)
		return newCreateDBError(err, "left_menu_links")
	}
	log.Infof("Left-Menu-Links created")
	return nil
}
