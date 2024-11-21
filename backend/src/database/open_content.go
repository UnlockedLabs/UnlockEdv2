package database

import (
	"UnlockEdv2/src/models"
	"sort"

	log "github.com/sirupsen/logrus"
)

func (db *DB) GetOpenContent(all bool) ([]models.OpenContentProvider, error) {
	var content []models.OpenContentProvider
	tx := db.Model(&models.OpenContentProvider{})
	if !all {
		tx.Where("currently_enabled = true")
	}
	if err := tx.Find(&content).Error; err != nil {
		return nil, newGetRecordsDBError(err, "open_content_providers")
	}
	return content, nil
}

func (db *DB) ToggleContentProvider(id int) error {
	var provider models.OpenContentProvider
	if err := db.Find(&provider, "id = ?", id).Error; err != nil {
		log.Errorln("unable to find conent provider with that ID")
		return newNotFoundDBError(err, "open_content_providers")
	}
	provider.CurrentlyEnabled = !provider.CurrentlyEnabled
	if err := db.Save(&provider).Error; err != nil {
		return newUpdateDBError(err, "open_content_providers")
	}
	return nil
}

func (db *DB) UpdateOpenContentProvider(prov *models.OpenContentProvider) error {
	if err := db.Save(prov).Error; err != nil {
		return newUpdateDBError(err, "open_content_providers")
	}
	return nil
}

func (db *DB) CreateContentProvider(provider *models.OpenContentProvider) error {
	if err := db.Create(&provider).Error; err != nil {
		return newCreateDBError(err, "open_content_providers")
	}
	return nil
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

func (db *DB) ToggleLibraryFavorite(contentParams *models.OpenContentParams) (bool, error) {
	var fav models.LibraryFavorite
	url := models.OpenContentUrl{}
	if db.Where("content_url = ?", contentParams.ContentUrl).First(&url).RowsAffected == 0 {
		url.ContentURL = contentParams.ContentUrl
		if err := db.Create(&url).Error; err != nil {
			log.Warn("unable to create content url for activity")
			return false, newCreateDBError(err, "open_content_urls")
		}
	}
	if db.Model(&models.LibraryFavorite{}).Where("user_id = ? AND content_id = ? AND open_content_url_id = ?", contentParams.UserID, contentParams.ContentID, url.ID).First(&fav).RowsAffected > 0 {
		if err := db.Delete(&fav).Error; err != nil {
			return false, newNotFoundDBError(err, "library_favorites")
		}
	} else {
		newFav := models.LibraryFavorite{
			UserID:                contentParams.UserID,
			ContentID:             contentParams.ContentID,
			OpenContentUrlID:      url.ID,
			Name:                  contentParams.Name,
			OpenContentProviderID: contentParams.OpenContentProviderID,
		}
		if err := db.Create(&newFav).Error; err != nil {
			return false, newCreateDBError(err, "library_favorites")
		}
	}
	return true, nil
}

func (db *DB) GetUserFavorites(userID uint, page, perPage int) (int64, []models.OpenContentFavorite, error) {
	var openContentFavorites []models.OpenContentFavorite
	if err := db.Table("library_favorites fav").
		Select(`
            fav.id,
            fav.name,
            'library' as type,
            fav.content_id,
            lib.image_url as thumbnail_url,
            ocp.description,
            NOT lib.visibility_status AS visibility_status,
            fav.open_content_provider_id,
            ocp.name AS provider_name,
            fav.created_at
        `).
		Joins(`JOIN open_content_providers ocp ON ocp.id = fav.open_content_provider_id
                AND ocp.currently_enabled = true 
                AND ocp.deleted_at IS NULL`).
		Joins(`JOIN libraries lib ON lib.id = fav.content_id 
                AND fav.open_content_provider_id = ocp.id`).
		Where("fav.user_id = ? AND fav.deleted_at IS NULL", userID).
		Order("fav.created_at desc").
		Scan(&openContentFavorites).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "library_favorites")
	}

	var videoFavorites []models.OpenContentFavorite
	if err := db.Table("video_favorites vf").
		Select(`
            vf.id,
            videos.title as name,
            'video' as type,
            vf.video_id as content_id,
            videos.thumbnail_url,
            videos.description,
            videos.open_content_provider_id,
            videos.channel_title,
            NOT videos.visibility_status as visibility_status
        `).
		Joins("JOIN videos on vf.video_id = videos.id").
		Joins(`JOIN open_content_providers ocp ON ocp.id = videos.open_content_provider_id
        AND ocp.currently_enabled = true 
        AND ocp.deleted_at IS NULL`).
		Where("vf.user_id = ? AND vf.deleted_at IS NULL", userID).
		Order("vf.created_at desc").
		Scan(&videoFavorites).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "video_favorites")
	}
	allFavorites := append(openContentFavorites, videoFavorites...)
	sort.Slice(allFavorites, func(i, j int) bool {
		return allFavorites[i].CreatedAt.After(allFavorites[j].CreatedAt)
	})

	total := int64(len(allFavorites))

	offset := (page - 1) * perPage
	if offset > len(allFavorites) {
		return total, []models.OpenContentFavorite{}, nil
	}
	end := offset + perPage
	if end > len(allFavorites) {
		end = len(allFavorites)
	}
	paginatedFavorites := allFavorites[offset:end]
	return total, paginatedFavorites, nil
}
