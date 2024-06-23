package database

import (
	"UnlockEdv2/src/models"

	log "github.com/sirupsen/logrus"
)

func (db *DB) GetLeftMenuLinks() ([]models.LeftMenuLink, error) {
	var links []models.LeftMenuLink
	if err := db.Conn.Find(&links).Error; err != nil {
		return nil, LogDbError(err, "Failed to get left menu links.")
	}
	return links, nil
}

func (db *DB) DeleteAllLinks() error {
	return LogDbError(db.Conn.Exec("DELETE FROM left_menu_links").Error, "Failed to delete left menu links.")
}

func (db *DB) CreateFreshLeftMenuLinks(links []models.LeftMenuLink) error {
	if err := db.Conn.Create(&links).Error; err != nil {
		return LogDbError(err, "Failed to create left menu links.")
	}
	log.Debugf("Left-Menu-Links created")
	return nil
}
