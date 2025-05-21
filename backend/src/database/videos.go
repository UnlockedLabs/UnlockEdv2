package database

import (
	"UnlockEdv2/src/models"
)

func (db *DB) GetVideoByID(id int, facilityId uint) (*models.Video, error) {
	var video models.Video
	query := db.Model(&models.Video{}).Preload("Attempts").
		Select("videos.*, fvs.visibility_status").
		Joins(`left outer join facility_visibility_statuses fvs on 
			fvs.open_content_provider_id = videos.open_content_provider_id and 
			fvs.content_id = videos.id and 
			fvs.facility_id = ?`, facilityId)

	if err := query.First(&video, id).Error; err != nil {
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
	IsFavorited bool `json:"is_favorited"`
}

func (db *DB) GetAllVideos(args *models.QueryContext, onlyVisible bool) ([]VideoResponse, error) {
	var videos []VideoResponse
	tx := db.WithContext(args.Ctx).Model(&models.Video{}).Preload("Attempts").Select(`
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
			Group("videos.id, fvs.visibility_status").Order("COUNT(f.id) DESC")
	default:
		tx = tx.Order(args.OrderClause("videos.created_at desc"))
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
	query := db.Model(&models.Video{}).
		Select("videos.*, fvs.visibility_status").
		Joins(`left outer join facility_visibility_statuses fvs on fvs.open_content_provider_id = videos.open_content_provider_id
			and fvs.content_id = videos.id
			and fvs.facility_id = ?`, facilityId)
	if err := query.Find(&video, "videos.id = ?", id).Error; err != nil {
		return newNotFoundDBError(err, "videos")
	}
	visibility := video.GetFacilityVisibilityStatus(facilityId)
	visibility.VisibilityStatus = !visibility.VisibilityStatus
	if err := db.Save(&visibility).Error; err != nil {
		return newUpdateDBError(err, "video visibility")
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
