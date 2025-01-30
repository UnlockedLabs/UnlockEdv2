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

// Retrieves either a paginated list of libraries or all libraries based upon the given parameters.
// page - the page number for pagination
// perPage - the number of libraries to display on page
// userId - the userId for which libraries to display for
// facilityId - the facility id of where the libraries were favorited
// visibility - can either be featured, visible, hidden, or all
// orderBy - the order in which the results are returned
// isAdmin - true or false on whether the user is an administrator used to determine how to retrieve featured libraries
// all - true or false on whether or not to return all libraries without pagination
// categoryIds - the category ids to filter the libraries by
func (db *DB) GetAllLibraries(page, perPage, days int, userId, facilityId uint, visibility, orderBy, search string, isAdmin, all bool, categoryIds []int) (int64, []LibraryResponse, error) {
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
	if len(categoryIds) > 0 {
		tx = tx.Joins("JOIN open_content_types t ON t.content_id = libraries.id").Where("t.category_id IN (?) AND t.open_content_provider_id = libraries.open_content_provider_id", categoryIds)
	}
	if err := tx.Count(&total).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "libraries")
	}

	switch strings.ToLower(orderBy) {
	case "most_popular":
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
	default:
		tx = tx.Order(orderBy)
	}
	if !all {
		tx = tx.Limit(perPage).Offset(calcOffset(page, perPage))
	}
	if err := tx.Find(&libraries).Error; err != nil {
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

func (db *DB) GetLibrariesByIDs(ids []int) ([]models.Library, error) {
	var libraries []models.Library
	tx := db.Preload("OpenContentProvider").Where("id in ?", ids)
	if len(ids) > 1 {
		tx.Where("language = 'eng'")
	}
	if err := tx.Find(&libraries).Error; err != nil {
		log.Errorln("unable to find libraries with these IDs")
		return nil, newNotFoundDBError(err, "libraries")
	}
	return libraries, nil
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
