package database

import (
	"UnlockEdv2/src/models"
	"strings"

	log "github.com/sirupsen/logrus"
)

type LibraryResponse struct {
	models.Library
	IsFavorited bool `json:"is_favorited"`
}

func (db *DB) GetAllLibraries(page, perPage int, userId, facilityId uint, visibility, orderBy, search string) (int64, []LibraryResponse, error) {
	var total int64
	libraries := make([]LibraryResponse, 0, perPage)

	tx := db.Model(&models.Library{}).Preload("OpenContentProvider").Select(`
        libraries.*,
        EXISTS (
            SELECT 1
            FROM open_content_favorites f
            WHERE f.content_id = libraries.id
              AND f.open_content_provider_id = libraries.open_content_provider_id
              AND f.user_id = ?
              AND f.deleted_at IS NULL
        ) AS is_favorited`, userId)

	visibility = strings.ToLower(visibility)

	isFeatured := false
	switch visibility {
	case "featured":
		// Join with open_content_favorites, ensuring facility_id is not null (admin-specific)
		tx = tx.Joins(`JOIN open_content_favorites f 
			ON f.content_id = libraries.id 
			AND f.open_content_provider_id = libraries.open_content_provider_id 
			AND f.facility_id IS NOT NULL`).Where("f.facility_id = ? AND visibility_status = true", facilityId)
		isFeatured = true
	case "visible":
		tx = tx.Where("visibility_status = true")
	case "hidden":
		tx = tx.Where("visibility_status = false")
	case "all":
	default:
		tx = tx.Where("visibility_status = true")
	}
	if search != "" {
		search = "%" + strings.ToLower(search) + "%"
		tx = tx.Where("LOWER(libraries.title) LIKE ? OR LOWER(libraries.description) LIKE ?", search, search)
	}
	if err := tx.Count(&total).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "libraries")
	}

	switch strings.ToLower(orderBy) {
	case "most_favorited":
		tx = tx.Select(`
            libraries.*,
            COUNT(f.id) AS favorite_count,
            EXISTS (
                SELECT 1
                FROM open_content_favorites f
                WHERE f.content_id = libraries.id
                  AND f.open_content_provider_id = libraries.open_content_provider_id
                  AND f.user_id = ?
                  AND f.deleted_at IS NULL
            ) AS is_favorited`, userId)
		if !isFeatured {
			tx = tx.Joins(`LEFT JOIN open_content_favorites f 
				ON f.content_id = libraries.id 
				AND f.open_content_provider_id = libraries.open_content_provider_id`)
		}
		tx = tx.Group("libraries.id").Order("favorite_count DESC")

	case "least_favorited":
		tx = tx.Select(`
            libraries.*,
            COUNT(f.id) AS favorite_count,
            EXISTS (
                SELECT 1
                FROM open_content_favorites f
                WHERE f.content_id = libraries.id
                  AND f.open_content_provider_id = libraries.open_content_provider_id
                  AND f.user_id = ?
                  AND f.deleted_at IS NULL
            ) AS is_favorited`, userId)
		if !isFeatured {
			tx = tx.Joins(`LEFT JOIN open_content_favorites f 
				ON f.content_id = libraries.id 
				AND f.open_content_provider_id = libraries.open_content_provider_id`)
		}
		tx = tx.Group("libraries.id").
			Order("favorite_count ASC")
	default:
		tx = tx.Order(orderBy)
	}
	if err := tx.Limit(perPage).Offset(calcOffset(page, perPage)).Find(&libraries).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "libraries")
	}

	return total, libraries, nil
}

func (db *DB) GetLibraryByID(id int) (*models.Library, error) {
	var library models.Library
	if err := db.Preload("OpenContentProvider").First(&library, "id = ?", id).Error; err != nil {
		log.Errorln("Unable to find library with that ID")
		return nil, newNotFoundDBError(err, "libraries")
	}
	return &library, nil
}

func (db *DB) ToggleVisibilityAndRetrieveLibrary(id int) (*models.Library, error) {
	var library models.Library
	if err := db.Preload("OpenContentProvider").Find(&library, "id = ?", id).Error; err != nil {
		log.Errorln("Unable to find library with that ID")
		return nil, newNotFoundDBError(err, "libraries")
	}
	library.VisibilityStatus = !library.VisibilityStatus
	if err := db.Save(&library).Error; err != nil {
		return nil, newUpdateDBError(err, "libraries")
	}
	return &library, nil
}
