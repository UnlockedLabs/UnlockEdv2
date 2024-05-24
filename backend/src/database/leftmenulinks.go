package database

import (
	"UnlockEdv2/src/models"
	"fmt"
	"log"
	"strings"

	"github.com/lib/pq"
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
		log.Printf("Error creating links: %v", err)
		return err
	}
	log.Println("Left-Menu-Links created")
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
}

func (db *DB) GetUserCatalogue(userId int, tags []string) ([]UserCatalogueJoin, error) {
	catalogue := []UserCatalogueJoin{}
	var queryBuilder strings.Builder
	queryBuilder.WriteString(fmt.Sprintf(`SELECT p.id as program_id, p.thumbnail_url, p.name as program_name,
    pp.name as provider_name, p.external_url, p.type as program_type, p.outcome_types,
    f.user_id IS NOT NULL as is_favorited
    FROM programs p
    LEFT JOIN provider_platforms pp ON p.provider_platform_id = pp.id
    LEFT JOIN favorites f ON f.program_id = p.id AND f.user_id = %d`, userId))

	if len(tags) > 0 {
		queryBuilder.WriteString(` WHERE (p.program_type IN ? OR ? = ANY (p.outcome_types))`)
		tagArgs := pq.Array(tags)
		err := db.Conn.Raw(queryBuilder.String(), tagArgs).Scan(&catalogue).Error
		if err != nil {
			return nil, err
		}
	} else {
		err := db.Conn.Raw(queryBuilder.String()).Scan(&catalogue).Error
		if err != nil {
			return nil, err
		}
	}
	return catalogue, nil
}
