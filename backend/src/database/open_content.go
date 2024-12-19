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

func (db *DB) GetUserFavorites(userID uint, page, perPage int) (int64, []models.OpenContentItem, error) {
	var total int64
	countQuery := `SELECT COUNT(*) FROM (
            SELECT fav.content_id
            FROM open_content_favorites fav
            JOIN libraries lib ON lib.id = fav.content_id
            JOIN open_content_providers ocp ON ocp.id = lib.open_content_provider_id
                AND ocp.currently_enabled = true 
                AND ocp.deleted_at IS NULL
            WHERE fav.user_id = ? AND fav.deleted_at IS NULL
        ) AS total_favorites
    `
	if err := db.Raw(countQuery, userID).Scan(&total).Error; err != nil {
		return 0, nil, err
	}

	favorites := make([]models.OpenContentItem, 0, perPage)
	favoritesQuery := `
    SELECT 
        content_type,
        content_id,
        title,
        url,
        thumbnail_url,
        description,
        visibility_status,
        open_content_provider_id,
        provider_name,
        channel_title,
        created_at
    FROM (
        SELECT
            'library' AS content_type,
            f.content_id,
            lib.title,
            lib.url,
            lib.thumbnail_url,
            ocp.description,
            lib.visibility_status,
            lib.open_content_provider_id,
            ocp.title AS provider_name,
            NULL AS channel_title,
            f.created_at
        FROM open_content_favorites f
        JOIN libraries lib ON lib.id = f.content_id
        JOIN open_content_providers ocp ON ocp.id = lib.open_content_provider_id
            AND ocp.currently_enabled = TRUE
            AND ocp.deleted_at IS NULL
        WHERE f.user_id = ? AND f.deleted_at IS NULL
            AND f.content_id IN (SELECT id FROM libraries where visibility_status = true)
        UNION ALL

        SELECT
            'video' AS content_type,
            f.content_id,
            videos.title,
            videos.url,
            videos.thumbnail_url,
            videos.description,
            videos.visibility_status,
            videos.open_content_provider_id,
            NULL AS provider_name,
            videos.channel_title,
            f.created_at
        FROM open_content_favorites f
        JOIN videos ON videos.id = f.content_id
        JOIN open_content_providers ocp ON ocp.id = videos.open_content_provider_id
            AND ocp.currently_enabled = TRUE
            AND ocp.deleted_at IS NULL
        WHERE f.user_id = ? AND f.deleted_at IS NULL
            AND f.content_id IN (SELECT id FROM videos where visibility_status = true AND availability = 'available')
    ) AS all_favorites
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?;
`
	if err := db.Raw(favoritesQuery, userID, userID, perPage, calcOffset(page, perPage)).Scan(&favorites).Error; err != nil {
		return 0, nil, err
	}

	return total, favorites, nil
}

func (db *DB) GetTopFacilityOpenContent(id int) ([]models.OpenContentItem, error) {
	var content []models.OpenContentItem
	if err := db.Raw("? UNION ? ORDER BY visits DESC LIMIT 5",
		db.Select("v.title, v.url, v.thumbnail_url, v.open_content_provider_id, v.id as content_id, 'video' as content_type, count(v.id) as visits").
			Table("open_content_activities oca").
			Joins("LEFT JOIN videos v ON v.id = oca.content_id AND v.open_content_provider_id = oca.open_content_provider_id AND v.visibility_status = TRUE").
			Where("oca.facility_id = ?", id).
			Group("v.title, v.url, v.thumbnail_url, v.open_content_provider_id, v.id").
			Having("count(v.id) > 0"),
		db.Select("l.title, l.url, l.thumbnail_url, l.open_content_provider_id, l.id as content_id, 'library' as content_type, count(l.id) as visits").
			Table("open_content_activities oca").
			Joins("LEFT JOIN libraries l on l.id = oca.content_id AND l.open_content_provider_id = oca.open_content_provider_id AND l.visibility_status = TRUE").
			Where("oca.facility_id = ?", id).
			Group("l.title, l.url, l.thumbnail_url, l.open_content_provider_id, l.id").
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
		db.Select("v.title, v.url, v.thumbnail_url, v.open_content_provider_id, v.id as content_id, 'video' as content_type, count(v.id) as visits").
			Table("open_content_activities oca").
			Joins("LEFT JOIN videos v ON v.id = oca.content_id AND v.open_content_provider_id = oca.open_content_provider_id AND v.visibility_status = TRUE").
			Where("oca.user_id = ?", id).
			Group("v.title, v.url, v.thumbnail_url, v.open_content_provider_id, v.id").
			Having("count(v.id) > 0"),
		db.Select("l.title, l.url, l.thumbnail_url, l.open_content_provider_id, l.id as content_id, 'library' as content_type, count(l.id) as visits").
			Table("open_content_activities oca").
			Joins("LEFT JOIN libraries l on l.id = oca.content_id AND l.open_content_provider_id = oca.open_content_provider_id AND l.visibility_status = TRUE").
			Where("oca.user_id = ?", id).
			Group("l.title, l.url, l.thumbnail_url, l.open_content_provider_id, l.id").
			Having("count(l.id) > 0"),
	).Find(&content).Error; err != nil {
		return nil, newGetRecordsDBError(err, "open_content_items")
	}
	return content, nil
}
