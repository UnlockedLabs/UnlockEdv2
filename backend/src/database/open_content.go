package database

import (
	"UnlockEdv2/src/models"

	log "github.com/sirupsen/logrus"
)

func (db *DB) GetOpenContent(all bool) ([]models.OpenContentProvider, error) {
	tx := db.Model(&models.OpenContentProvider{})
	if !all {
		tx = tx.Where("currently_enabled = ?", true)
	}
	openContent := make([]models.OpenContentProvider, 0, 3)
	if err := tx.Find(&openContent).Error; err != nil {
		return nil, newNotFoundDBError(err, "open_content_providers")
	}
	return openContent, nil
}

func (db *DB) FindKolibriInstance() (*models.ProviderPlatform, error) {
	kolibri := models.ProviderPlatform{}
	if err := db.First(&kolibri, "type = ?", "kolibri").Error; err != nil {
		log.Error("error getting kolibri provider platform")
		return nil, newNotFoundDBError(err, "provider_platforms")
	}
	return &kolibri, nil
}

func (db *DB) CreateContentActivity(urlString string, activity *models.OpenContentActivity) {
	url := models.OpenContentUrl{}
	if db.Where("content_url = ?", urlString).First(&url).RowsAffected == 0 {
		url.ContentURL = urlString
		if err := db.Create(&url).Error; err != nil {
			log.Warn("unable to create content url for activity")
			return
		}
	}
	activity.OpenContentUrlID = url.ID
	if err := db.Create(&activity).Error; err != nil {
		log.Warn("unable to create content activity for url, ", urlString)
	}
}

// facilityID will be nil if non-admin user, facilityID == 'featured'
func (db *DB) ToggleLibraryFavorite(userId uint, facilityId *uint, libId int) error {
	tx := db.Model(&models.LibraryFavorite{}).Where("library_id = ?", libId)
	if facilityId != nil {
		tx = tx.Where("facility_id = ?", facilityId)
	} else {
		tx = tx.Where("facility_id IS NULL AND user_id = ?", userId)
	}
	if err := tx.First(&models.LibraryFavorite{}).Error; err == nil {
		if err := db.Unscoped().Delete(&models.LibraryFavorite{}, tx).Error; err != nil {
			return newNotFoundDBError(err, "library_favorites")
		}
		return nil
	}
	fav := models.LibraryFavorite{UserID: userId, LibraryID: uint(libId), FacilityID: facilityId}
	if err := db.Create(&fav).Error; err != nil {
		return newCreateDBError(err, "library_favorites")
	}
	return nil
}

func (db *DB) GetUserFavorites(userID uint, page, perPage int) (int64, []models.OpenContentFavorite, error) {
	var total int64
	countQuery := `
        SELECT COUNT(*) FROM (
            SELECT fav.id
            FROM library_favorites fav
            JOIN libraries lib ON lib.id = fav.library_id
            JOIN open_content_providers ocp ON ocp.id = lib.open_content_provider_id
                AND ocp.currently_enabled = true 
                AND ocp.deleted_at IS NULL
            WHERE fav.user_id = ? AND fav.deleted_at IS NULL
            UNION ALL
            SELECT vf.id
            FROM video_favorites vf
            JOIN videos ON vf.video_id = videos.id
            JOIN open_content_providers ocp ON ocp.id = videos.open_content_provider_id
                AND ocp.currently_enabled = true 
                AND ocp.deleted_at IS NULL
            WHERE vf.user_id = ? AND vf.deleted_at IS NULL
        ) AS total_favorites
    `
	if err := db.Raw(countQuery, userID, userID).Scan(&total).Error; err != nil {
		return 0, nil, err
	}

	favorites := make([]models.OpenContentFavorite, 0, perPage)
	favoritesQuery := `
        SELECT 
            id,
            content_type,
            content_id,
            name,
            thumbnail_url,
            description,
            visibility_status,
            open_content_provider_id,
            provider_name,
            channel_title,
            created_at
        FROM (
            SELECT
                fav.id AS id,
                'library' AS content_type,
                fav.library_id AS content_id,
                lib.name AS name,
                lib.thumbnail_url AS thumbnail_url,
                ocp.description AS description,
                NOT lib.visibility_status AS visibility_status,
                lib.open_content_provider_id AS open_content_provider_id,
                ocp.name AS provider_name,
                NULL AS channel_title,
                fav.created_at AS created_at
            FROM library_favorites fav
            JOIN libraries lib ON lib.id = fav.library_id
            JOIN open_content_providers ocp ON ocp.id = lib.open_content_provider_id
                AND ocp.currently_enabled = true 
                AND ocp.deleted_at IS NULL
            WHERE fav.user_id = ? AND fav.deleted_at IS NULL

            UNION ALL

            SELECT
                vf.id AS id,
                'video' AS content_type,
                vf.video_id AS content_id,
                videos.title AS name,
                videos.thumbnail_url AS thumbnail_url,
                videos.description AS description,
                NOT videos.visibility_status AS visibility_status,
                videos.open_content_provider_id AS open_content_provider_id,
                NULL AS provider_name,
                videos.channel_title AS channel_title,
                vf.created_at AS created_at
            FROM video_favorites vf
            JOIN videos ON vf.video_id = videos.id
            JOIN open_content_providers ocp ON ocp.id = videos.open_content_provider_id
                AND ocp.currently_enabled = true 
                AND ocp.deleted_at IS NULL
            WHERE vf.user_id = ? AND vf.deleted_at IS NULL
        ) AS all_favorites
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `
	if err := db.Raw(favoritesQuery, userID, userID, perPage, calcOffset(page, perPage)).Scan(&favorites).Error; err != nil {
		return 0, nil, err
	}

	return total, favorites, nil
}

func (db *DB) GetTopFacilityOpenContent(id int) ([]models.OpenContentItem, error) {
	var content []models.OpenContentItem
	if err := db.Raw("? UNION ? ORDER BY visits DESC LIMIT 5",
		db.Select("v.title as name, v.url, v.thumbnail_url, v.open_content_provider_id, v.id as content_id, 'video' as type, count(v.id) as visits").
			Table("open_content_activities oca").
			Joins("LEFT JOIN videos v ON v.id = oca.content_id AND v.open_content_provider_id = oca.open_content_provider_id AND v.visibility_status = TRUE").
			Where("oca.facility_id = ?", id).
			Group("v.title, v.url, v.thumbnail_url, v.open_content_provider_id, v.id").
			Having("count(v.id) > 0"),
		db.Select("l.name, l.path as url, l.thumbnail_url as thumbnail_url, l.open_content_provider_id, l.id as content_id, 'library' as type, count(l.id) as visits").
			Table("open_content_activities oca").
			Joins("LEFT JOIN libraries l on l.id = oca.content_id AND l.open_content_provider_id = oca.open_content_provider_id AND l.visibility_status = TRUE").
			Where("oca.facility_id = ?", id).
			Group("l.name, l.path, l.thumbnail_url, l.open_content_provider_id, l.id").
			Having("count(l.id) > 0"),
	).Find(&content).Error; err != nil {
		return nil, newGetRecordsDBError(err, "open_content_items")
	}
	return content, nil
}

func (db *DB) GetTopUserOpenContent(id int) ([]models.OpenContentItem, error) {
	var content []models.OpenContentItem
	log.Println(id)
	if err := db.Raw("? UNION ? ORDER BY visits DESC LIMIT 5",
		db.Select("v.title as name, v.url, v.thumbnail_url, v.open_content_provider_id, v.id as content_id, 'video' as type, count(v.id) as visits").
			Table("open_content_activities oca").
			Joins("LEFT JOIN videos v ON v.id = oca.content_id AND v.open_content_provider_id = oca.open_content_provider_id AND v.visibility_status = TRUE").
			Where("oca.user_id = ?", id).
			Group("v.title, v.url, v.thumbnail_url, v.open_content_provider_id, v.id").
			Having("count(v.id) > 0"),
		db.Select("l.name, l.path as url, l.thumbnail_url as thumbnail_url, l.open_content_provider_id, l.id as content_id, 'library' as type, count(l.id) as visits").
			Table("open_content_activities oca").
			Joins("LEFT JOIN libraries l on l.id = oca.content_id AND l.open_content_provider_id = oca.open_content_provider_id AND l.visibility_status = TRUE").
			Where("oca.user_id = ?", id).
			Group("l.name, l.path, l.thumbnail_url, l.open_content_provider_id, l.id").
			Having("count(l.id) > 0"),
	).Find(&content).Error; err != nil {
		return nil, newGetRecordsDBError(err, "open_content_items")
	}
	return content, nil
}
