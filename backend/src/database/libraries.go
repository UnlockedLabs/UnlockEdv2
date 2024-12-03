package database

import (
	"UnlockEdv2/src/models"
	"strings"

	log "github.com/sirupsen/logrus"
)

func (db *DB) GetAllLibraries(page, perPage int, userId, facilityId uint, visibility, orderBy, search string) (int64, []models.Library, error) {
	var total int64
	libraries := make([]models.Library, 0, perPage)
	tx := db.Model(&models.Library{}).
		Preload("OpenContentProvider")
	visibility = strings.ToLower(visibility)

	switch strings.ToLower(visibility) {
	case "featured":
		tx = tx.Preload("Favorites", "facility_id = ?", facilityId).Joins("JOIN library_favorites l ON l.library_id = libraries.id AND l.facility_id IS NOT NULL").Where("visibility_status = true")
	case "visible":
		tx = tx.Preload("Favorites", "user_id = ?", userId).Where("visibility_status = true")
	case "hidden":
		tx = tx.Preload("Favorites", "user_id = ?", userId).Where("visibility_status = false")
	case "all":
		tx = tx.Preload("Favorites", "facility_id = ?", facilityId)
	}

	if search != "" {
		search = "%" + strings.ToLower(search) + "%"
		tx = tx.Where("LOWER(name) LIKE ?", search)
	}

	if err := tx.Count(&total).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "libraries")
	}

	if strings.ToLower(orderBy) == "most_favorited" {
		tx = tx.Select("libraries.*, COUNT(library_favorites.id) AS favorite_count").
			Joins("LEFT JOIN library_favorites ON libraries.id = library_favorites.library_id").
			Group("libraries.id").
			Order("favorite_count DESC")
	} else if strings.ToLower(orderBy) == "least_favorited" {
		tx = tx.Select("libraries.*, COUNT(library_favorites.id) AS favorite_count").
			Joins("LEFT JOIN library_favorites ON libraries.id = library_favorites.library_id").
			Group("libraries.id").
			Order("favorite_count ASC")
	} else {
		tx = tx.Order(orderBy)
	}

	if err := tx.Limit(perPage).Offset(calcOffset(page, perPage)).Find(&libraries).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "libraries")
	}
	for i := range libraries {
		if libraries[i].Favorites == nil {
			libraries[i].Favorites = []models.LibraryFavorite{}
		}
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
