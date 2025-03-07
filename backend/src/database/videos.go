package database

import (
	"UnlockEdv2/src/models"
	"errors"

	"gorm.io/gorm"
)

func (db *DB) GetVideoByID(id int, facilityId uint) (*models.Video, bool, error) {
	var video models.Video
	var videoVisibility models.FacilityVisibilityStatus
	if err := db.Preload("Attempts").First(&video, id).Error; err != nil {
		return nil, false, newNotFoundDBError(err, "videos")
	}
	err := db.Where("open_content_provider_id = ? and content_id = ? and facility_id = ?", video.OpenContentProviderID, video.ID, facilityId).First(&videoVisibility).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &video, false, nil
		}
		return &video, false, newNotFoundDBError(err, "video visibility")
	}
	return &video, videoVisibility.VisibilityStatus, nil
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
	//added user id to query below to isolate favorite by user when facility id is passed in
	tx := db.Where("content_id = ? AND open_content_provider_id = ?", contentID, ocpID).
		Where("open_content_url_id IS NULL OR name IS NULL OR name = ''")
	if facilityID != nil {
		tx = tx.Where("facility_id = ?", facilityID)
	} else {
		tx = tx.Where("user_id = ?", userID)
	}
	if tx.First(&models.OpenContentFavorite{}).RowsAffected > 0 {
		delTx := db.Where("content_id = ? AND open_content_provider_id = ?  ", contentID, ocpID).
			Where("open_content_url_id IS NULL OR name IS NULL OR name = ''")
		if facilityID != nil {
			delTx = delTx.Where("facility_id = ?", facilityID)
		} else {
			delTx = delTx.Where("user_id = ?", userID)
		}
		if err := delTx.Delete(&fav).Error; err != nil {
			return false, newDeleteDBError(err, "open_content_favorites")
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
	IsFavorited      bool `json:"is_favorited"`
	VisibilityStatus bool `json:"visibility_status" `
}

func (db *DB) GetAllVideos(args *models.QueryContext, onlyVisible bool) ([]VideoResponse, error) {
	var videos []VideoResponse
	tx := db.Model(&models.Video{}).Preload("Attempts").Select(`
	videos.*,
        CASE WHEN fvs.visibility_status is null then false 
        else fvs.visibility_status
    end as visibility_status,
	EXISTS (
		SELECT 1
		FROM open_content_favorites f
		WHERE f.content_id = videos.id
		  AND f.open_content_provider_id = videos.open_content_provider_id
		  AND f.user_id = ?
	) AS is_favorited`, args.UserID).
		Joins(`left join facility_visibility_statuses fvs 
        on fvs.open_content_provider_id = videos.open_content_provider_id
        and fvs.content_id = videos.id 
        and fvs.facility_id = ?`, args.FacilityID)

	if onlyVisible {
		tx = tx.Where("fvs.visibility_status = ?", true)
	}
	if args.Search != "" {
		args.Search = "%" + args.Search + "%"
		tx = tx.Where("LOWER(title) LIKE ? OR LOWER(channel_title) LIKE ?", args.Search, args.Search)
	}
	switch args.OrderBy {
	case "most_popular":
		tx = tx.Joins("LEFT JOIN open_content_favorites f ON f.content_id = videos.id AND f.open_content_provider_id = videos.open_content_provider_id").
			Group("videos.id").Order("COUNT(f.id) DESC")
	default:
		tx = tx.Order(args.OrderBy)
	}
	if err := tx.Count(&args.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "videos")
	}
	if err := tx.Offset(args.CalcOffset()).Limit(args.PerPage).Find(&videos).Error; err != nil {
		return nil, newGetRecordsDBError(err, "videos")
	}
	return videos, nil
}

func (db *DB) ToggleVideoVisibility(id int, facilityId uint) error {
	var video models.Video
	var videoVisibility models.FacilityVisibilityStatus
	if err := db.First(&video, id).Error; err != nil {
		return newNotFoundDBError(err, "videos")
	}
	if db.Where("open_content_provider_id = ? and content_id = ? and facility_id = ?", video.OpenContentProviderID, video.ID, facilityId).First(&videoVisibility).RowsAffected > 0 {
		videoVisibility.VisibilityStatus = !videoVisibility.VisibilityStatus
		if err := db.Save(&videoVisibility).Error; err != nil {
			return newUpdateDBError(err, "video visibility")
		}
	} else {
		videoVisibility = models.FacilityVisibilityStatus{
			FacilityID:            facilityId,
			OpenContentProviderID: video.OpenContentProviderID,
			ContentID:             video.ID,
			VisibilityStatus:      true,
		}
		if err := db.Create(&videoVisibility).Error; err != nil {
			return newCreateDBError(err, "video visibility")
		}
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
