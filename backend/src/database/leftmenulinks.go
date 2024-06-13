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
