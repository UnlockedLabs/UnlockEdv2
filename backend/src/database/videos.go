package database

import "UnlockEdv2/src/models"

func (db *DB) GetVideoByID(id int) (*models.Video, error) {
	var video models.Video
	if err := db.First(&video, id).Error; err != nil {
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

// onlyVisible parameter is for student users who can not see all selections
func (db *DB) GetAllVideos(onlyVisible bool, page, perPage int) ([]models.Video, error) {
	var videos []models.Video
	tx := db.Model(&models.Video{})
	if onlyVisible {
		tx = tx.Where("visibility_status = ?", true)
	}
	offset := (page - 1) * perPage
	if err := tx.Preload("Attempts").Offset(offset).Limit(perPage).Find(&videos).Error; err != nil {
		return nil, newGetRecordsDBError(err, "videos")
	}
	return videos, nil
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
