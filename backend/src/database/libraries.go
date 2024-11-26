package database

import (
	"UnlockEdv2/src/models"
	"strings"

	log "github.com/sirupsen/logrus"
)

func (db *DB) GetAllLibraries(page, perPage, providerId int, userId, facilityID uint, visibility, search string) (int64, []models.LibraryDto, error) {
	var libraries []models.LibraryDto
	var total int64
	offset := (page - 1) * perPage
	tx := db.Table("libraries lib").
		Select(`lib.id, lib.open_content_provider_id, lib.external_id, lib.name, lib.language, 
            lib.description, lib.path, lib.image_url, lib.visibility_status, ocf.id IS NOT NULL as is_favorited, 
            foc.id IS NOT NULL as is_featured,
            ocp.base_url, ocp.thumbnail, ocp.currently_enabled, ocp.description as open_content_provider_desc, 
            ocp.name as open_content_provider_name`).
		Joins(`join open_content_providers ocp on ocp.id = lib.open_content_provider_id 
                and ocp.currently_enabled = true
                and ocp.deleted_at IS NULL`).
		Joins(`left join (select ocf.user_id, ocf.content_id, ocf.id, ocf.open_content_provider_id
                from library_favorites ocf
                join open_content_urls urls on urls.id = ocf.open_content_url_id
                    and urls.content_url LIKE '/api/proxy/libraries/%/'
                    where ocf.deleted_at IS NULL 
                ) ocf on ocf.content_id = lib.id
                    and ocf.open_content_provider_id = ocp.id 
                    and ocf.user_id = ?`, userId).
		Joins(`left join featured_open_content foc on foc.content_id = lib.id and foc.open_content_provider_id = lib.open_content_provider_id 
        and foc.facility_id = ? and foc.deleted_at IS NULL`, facilityID).
		Where("lib.deleted_at IS NULL").
		Order("lib.created_at DESC")
	visibility = strings.ToLower(visibility)
	if visibility == "hidden" {
		tx = tx.Where("lib.visibility_status = false")
	}
	if visibility == "visible" {
		tx = tx.Where("lib.visibility_status = true")
	}
	if visibility == "featured" {
		tx = tx.Where("foc.id IS NOT NULL")
	}
	if search != "" {
		search = "%" + strings.ToLower(search) + "%"
		tx = tx.Where("LOWER(lib.name) LIKE ?", search)
	}
	if providerId != 0 {
		tx = tx.Where("lib.open_content_provider_id = ?", providerId)
	}
	if err := tx.Count(&total).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "libraries")
	}
	if err := tx.Limit(perPage).Offset(offset).Find(&libraries).Error; err != nil {
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
