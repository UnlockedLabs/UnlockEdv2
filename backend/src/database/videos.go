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
	if err := db.First(&provider, "name = ?", models.Youtube).Error; err != nil {
		return nil, newNotFoundDBError(err, "open_content_providers")
	}
	return &provider, nil
}

func (db *DB) FavoriteVideo(vidID int, userID uint) (bool, error) {
	fav := models.VideoFavorite{
		VideoID: uint(vidID),
		UserID:  userID,
	}
	if db.Where("video_id = ? AND user_id = ?", vidID, userID).First(&models.VideoFavorite{}).RowsAffected > 0 {
		if err := db.Where("video_id = ? AND user_id = ?", vidID, userID).Delete(&fav).Error; err != nil {
			return false, newDeleteDBError(err, "video_favorites")
		}
		return false, nil
	} else {
		if err := db.Create(&fav).Error; err != nil {
			return false, newCreateDBError(err, "video_favorites")
		}
	}
	return true, nil
}

func (db *DB) GetAllVideos(onlyVisible bool, page, perPage int, search, orderBy string, userID uint) (int64, []models.Video, error) {
	var videos []models.Video
	tx := db.Model(&models.Video{}).Preload("Attempts").Preload("Favorites", "user_id = ?", userID)
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
			tx = tx.Joins("LEFT JOIN video_favorites ON video_favorites.video_id = videos.id").Group("videos.id").Order("COUNT(video_favorites.id) DESC")
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
