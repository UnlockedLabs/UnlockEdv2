package database

import (
	"UnlockEdv2/src/models"
)

func (db *DB) GetVideoByID(id int) (*models.Video, error) {
	var video models.Video
	if err := db.Preload("Attempts").First(&video, id).Error; err != nil {
		return nil, newNotFoundDBError(err, "videos")
	}
	return &video, nil
}

func (db *DB) GetVideoProvider() (*models.OpenContentProvider, error) {
	var provider models.OpenContentProvider
	if err := db.First(&provider, "title = ?", models.Youtube).Error; err != nil {
		return nil, newNotFoundDBError(err, "open_content_providers")
	}
	return &provider, nil
}

func (db *DB) FavoriteOpenContent(contentID int, ocpID uint, userID uint, facilityID *uint) (bool, error) {
	fav := models.OpenContentFavorite{
		ContentID:             uint(contentID),
		OpenContentProviderID: ocpID,
		UserID:                userID,
		FacilityID:            facilityID,
	}
	//use Unscoped method to ignore soft deletions
	tx := db.Unscoped().Where("content_id = ? AND open_content_provider_id = ?", contentID, ocpID)
	if facilityID != nil {
		tx = tx.Where("facility_id = ?", facilityID)
	}
	if tx.First(&models.OpenContentFavorite{}).RowsAffected > 0 {
		delTx := db.Where("content_id = ? AND user_id = ? AND open_content_provider_id = ?", contentID, userID, ocpID)
		if facilityID != nil {
			delTx = delTx.Where("facility_id = ?", facilityID)
		}
		if err := delTx.Unscoped().Delete(&fav).Error; err != nil {
			return false, newDeleteDBError(err, "video_favorites")
		}
		return false, nil
	} else {
		if err := db.Create(&fav).Error; err != nil {
			return false, newCreateDBError(err, "open_content_favorites")
		}
		return true, nil
	}
}

type VideoResponse struct {
	models.Video
	IsFavorited bool `json:"is_favorited"`
}

func (db *DB) GetAllVideos(onlyVisible bool, page, perPage int, search, orderBy string, userID uint) (int64, []VideoResponse, error) {
	var videos []VideoResponse
	tx := db.Model(&models.Video{}).Preload("Attempts").Select(`
	videos.*,
	EXISTS (
		SELECT 1
		FROM open_content_favorites f
		WHERE f.content_id = videos.id
		  AND f.open_content_provider_id = videos.open_content_provider_id
		  AND f.user_id = ?
	) AS is_favorited`, userID)
	var total int64
	validOrder := map[string]bool{
		"title ASC":       true,
		"title DESC":      true,
		"created_at ASC":  true,
		"created_at DESC": true,
		"favorited":       true,
	}
	if onlyVisible {
		tx = tx.Where("visibility_status = ?", true)
	}
	if search != "" {
		search = "%" + search + "%"
		tx = tx.Where("LOWER(title) LIKE ? OR LOWER(channel_title) LIKE ?", search, search)
	}
	if valid, ok := validOrder[orderBy]; ok && valid {
		if orderBy == "favorited" {
			tx = tx.Joins("LEFT JOIN open_content_favorites f ON f.content_id = videos.id AND f.open_content_provider_id = videos.open_content_provider_id").
				Group("videos.id").Order("COUNT(f.id) DESC")
		} else {
			tx = tx.Order(orderBy)
		}
	} else {
		tx = tx.Order("created_at DESC")
	}
	if err := tx.Count(&total).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "videos")
	}
	if err := tx.Offset(calcOffset(page, perPage)).Limit(perPage).Find(&videos).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "videos")
	}
	return total, videos, nil
}

func (db *DB) ToggleVideoVisibility(id int) error {
	var video models.Video
	if err := db.First(&video, id).Error; err != nil {
		return newNotFoundDBError(err, "videos")
	}
	video.VisibilityStatus = !video.VisibilityStatus
	if err := db.Save(&video).Error; err != nil {
		return newUpdateDBError(err, "videos")
	}
	return nil
}

func (db *DB) DeleteVideo(id int) error {
	vid := models.Video{}
	vid.ID = uint(id)
	if err := db.Delete(&vid).Error; err != nil {
		return newCreateDBError(err, "videos")
	}
	return nil
}
