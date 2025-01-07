package database

import (
	"UnlockEdv2/src/models"
	"fmt"
	"strings"

	log "github.com/sirupsen/logrus"
)

type LibraryResponse struct {
	models.Library
	IsFavorited bool `json:"is_favorited"`
}

func (db *DB) GetAllLibraries(page, perPage, days int, userId, facilityId uint, visibility, orderBy, search string, isAdmin bool) (int64, []LibraryResponse, error) {
	var (
		total    int64
		criteria string
		id       uint
	)
	libraries := make([]LibraryResponse, 0, perPage)
	//added the below to display featuring flags for all admins per facility
	selectIsFavoriteOrIsFeatured := `
        libraries.*,
        EXISTS (
            SELECT 1
            FROM open_content_favorites f
            WHERE f.content_id = libraries.id
              AND f.open_content_provider_id = libraries.open_content_provider_id
			  AND %s) AS is_favorited`

	if isAdmin {
		criteria, id = "f.facility_id = ?", facilityId
	} else {
		criteria, id = "f.user_id = ?", userId
	}
	tx := db.Model(&models.Library{}).Preload("OpenContentProvider").Select(fmt.Sprintf(selectIsFavoriteOrIsFeatured, criteria), id)
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
