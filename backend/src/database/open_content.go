package database

import (
	"UnlockEdv2/src/models"
	"fmt"
	"time"

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

func (db *DB) UpdateOpenContentActivityStopTS(activityID int64) {
	if err := db.Model(&models.OpenContentActivity{}).Where("id = ?", activityID).Update("stop_ts", time.Now()).Error; err != nil {
		log.Errorf("error updating open content activity: %v", err)
	}
}

// This method will at most ever return the most recent 30 favorites (10 Libraries, 10 Videos, 10 Helpful Links)
func (db *DB) GetUserFavoriteGroupings(args *models.QueryContext) ([]models.OpenContentItem, error) {
	favorites := make([]models.OpenContentItem, 0, 30)
	favoritesQuery := `WITH ordered_libraries AS (
		SELECT
			'library' AS content_type,
			f.content_id,
            COALESCE(NULLIF(f.name, ''), lib.title) as title,
            COALESCE(ocu.content_url, lib.url) AS url,  
			lib.thumbnail_url,
			ocp.description,
			fvs.visibility_status,
			lib.open_content_provider_id,
			ocp.title AS provider_name,
			NULL AS channel_title,
			f.created_at,
			ROW_NUMBER() OVER (ORDER BY f.created_at DESC) AS row_num
		FROM open_content_favorites f
		JOIN open_content_providers ocp ON ocp.id = f.open_content_provider_id
			AND ocp.currently_enabled = TRUE
			AND ocp.deleted_at IS NULL
		JOIN libraries lib ON lib.open_content_provider_id = ocp.id 
			AND lib.id = f.content_id
		left outer join facility_visibility_statuses fvs on fvs.open_content_provider_id = lib.open_content_provider_id
				and fvs.content_id = lib.id
				and fvs.facility_id = ?
        LEFT JOIN open_content_urls ocu ON f.open_content_url_id = ocu.id  
		WHERE f.user_id = ?
	),
	ordered_videos AS (
		SELECT
			'video' AS content_type,
			f.content_id,
			videos.title,
			videos.url,
			videos.thumbnail_url,
			videos.description,
    fvs.visibility_status,
			videos.open_content_provider_id,
			NULL AS provider_name,
			videos.channel_title,
			f.created_at,
			ROW_NUMBER() OVER (ORDER BY f.created_at DESC) AS row_num
		FROM open_content_favorites f
		JOIN open_content_providers ocp ON ocp.id = f.open_content_provider_id
			AND ocp.currently_enabled = TRUE
			AND ocp.deleted_at IS NULL
		JOIN videos ON videos.open_content_provider_id = ocp.id
			AND videos.id = f.content_id
		left outer join facility_visibility_statuses fvs on fvs.open_content_provider_id = videos.open_content_provider_id
            and fvs.content_id = videos.id
            and fvs.facility_id = ?
		WHERE f.user_id = ?
			AND f.content_id IN (SELECT id FROM videos where availability = 'available')
	),
	ordered_helpful_links AS (
		SELECT
			'helpful_link' AS content_type,
			f.content_id AS content_id,
			hl.title,
			hl.url,
			hl.thumbnail_url,
			hl.description,
			hl.visibility_status,
			hl.open_content_provider_id AS open_content_provider_id,
			NULL AS provider_name,
			NULL AS channel_title,
			f.created_at,
			ROW_NUMBER() OVER (ORDER BY f.created_at DESC) AS row_num
		FROM open_content_favorites f
		JOIN open_content_providers ocp ON ocp.id = f.open_content_provider_id
				AND ocp.currently_enabled = TRUE
				AND ocp.deleted_at IS NULL
		JOIN helpful_links hl ON hl.open_content_provider_id = ocp.id
				AND hl.id = f.content_id
		WHERE f.user_id = ?
	)
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
		SELECT * FROM ordered_libraries WHERE row_num <= 10
		UNION ALL
		SELECT * FROM ordered_videos WHERE row_num <= 10
		UNION ALL
		SELECT * FROM ordered_helpful_links WHERE row_num <= 10
	)`
	if err := db.WithContext(args.Ctx).Raw(favoritesQuery, args.FacilityID, args.UserID, args.FacilityID, args.UserID, args.UserID).Scan(&favorites).Error; err != nil {
		return nil, err
	}
	return favorites, nil
}

func (db *DB) GetUserFavorites(args *models.QueryContext) ([]models.OpenContentItem, error) {
	var libSearchCond, videoSearchCond, hlSearchCond string
	var searchTerm string

	if args.Search != "" {
		searchTerm = args.SearchQuery()
		libSearchCond = "AND LOWER(lib.title) LIKE ?"
		videoSearchCond = "AND LOWER(videos.title) LIKE ?"
		hlSearchCond = "AND LOWER(hl.title) LIKE ?"
	}

	countArgs := []any{args.UserID}
	if args.Search != "" {
		countArgs = append(countArgs, searchTerm)
	}

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM (
		SELECT fav.content_id
		FROM open_content_favorites fav
		JOIN libraries lib ON lib.id = fav.content_id
		JOIN open_content_providers ocp ON ocp.id = lib.open_content_provider_id
			AND ocp.currently_enabled = true
			AND ocp.deleted_at IS NULL
		WHERE fav.user_id = ? %s
	) AS total_favorites`, libSearchCond)

	if err := db.WithContext(args.Ctx).Raw(countQuery, countArgs...).Scan(&args.Total).Error; err != nil {
		return nil, err
	}

	queryArgs := make([]any, 0, 8)

	// Libraries
	queryArgs = append(queryArgs, args.FacilityID, args.UserID)
	if args.Search != "" {
		queryArgs = append(queryArgs, searchTerm)
	}
	// Videos
	queryArgs = append(queryArgs, args.FacilityID, args.UserID)
	if args.Search != "" {
		queryArgs = append(queryArgs, searchTerm)
	}
	// Helpful links
	queryArgs = append(queryArgs, args.UserID)
	if args.Search != "" {
		queryArgs = append(queryArgs, searchTerm)
	}
	queryArgs = append(queryArgs, args.PerPage, args.CalcOffset())

	favoritesQuery := fmt.Sprintf(`SELECT
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
        -- Libraries block:
        SELECT
            'library' AS content_type,
            f.content_id,
            COALESCE(NULLIF(f.name, ''), lib.title) as title,
            COALESCE(ocu.content_url, lib.url) AS url,  
            lib.thumbnail_url,
            ocp.description,
			fvs.visibility_status,
            lib.open_content_provider_id,
            ocp.title AS provider_name,
            NULL AS channel_title,
            f.created_at
        FROM open_content_favorites f
        JOIN open_content_providers ocp ON ocp.id = f.open_content_provider_id
            AND ocp.currently_enabled = TRUE
            AND ocp.deleted_at IS NULL
        JOIN libraries lib ON lib.open_content_provider_id = ocp.id
            AND lib.id = f.content_id
		left outer join facility_visibility_statuses fvs on fvs.open_content_provider_id = lib.open_content_provider_id
				and fvs.content_id = lib.id
				and fvs.facility_id = ?
        LEFT JOIN open_content_urls ocu ON f.open_content_url_id = ocu.id  
        WHERE f.user_id = ? %s

        UNION ALL

        -- Videos block:
        SELECT
            'video' AS content_type,
            f.content_id,
            videos.title,
            videos.url,
            videos.thumbnail_url,
            videos.description,
        fvs.visibility_status,
            videos.open_content_provider_id,
            NULL AS provider_name,
            videos.channel_title,
            f.created_at
        FROM open_content_favorites f
        JOIN open_content_providers ocp ON ocp.id = f.open_content_provider_id
            AND ocp.currently_enabled = TRUE
            AND ocp.deleted_at IS NULL
        JOIN videos ON videos.open_content_provider_id = ocp.id
            AND videos.id = f.content_id
        left outer join facility_visibility_statuses fvs on fvs.open_content_provider_id = videos.open_content_provider_id
				and fvs.content_id = videos.id
				and fvs.facility_id = ?
        WHERE f.user_id = ? %s

        UNION ALL

        SELECT
            'helpful_link' AS content_type,
            f.content_id AS content_id,
            hl.title,
            hl.url,
            hl.thumbnail_url,
            hl.description,
            hl.visibility_status,
            hl.open_content_provider_id AS open_content_provider_id,
            NULL AS provider_name,
            NULL AS channel_title,
            f.created_at
        FROM open_content_favorites f
        JOIN open_content_providers ocp ON ocp.id = f.open_content_provider_id
            AND ocp.currently_enabled = TRUE
            AND ocp.deleted_at IS NULL
        JOIN helpful_links hl ON hl.open_content_provider_id = ocp.id
            AND hl.id = f.content_id
        WHERE f.user_id = ? %s
    ) AS all_favorites
    ORDER BY %s
	LIMIT ? OFFSET ?`, libSearchCond, videoSearchCond, hlSearchCond, args.OrderClause("all_favorites.created_at desc"))

	var favorites []models.OpenContentItem
	if err := db.WithContext(args.Ctx).Raw(favoritesQuery, queryArgs...).Scan(&favorites).Error; err != nil {
		return nil, err
	}

	return favorites, nil
}

func (db *DB) GetTopFacilityOpenContent(id int) ([]models.OpenContentItem, error) {
	var content []models.OpenContentItem
	if err := db.Raw("? UNION ? ORDER BY visits DESC LIMIT 5",
		db.Select("fvs.visibility_status, v.title, v.url, v.thumbnail_url, v.open_content_provider_id, v.id as content_id, 'video' as content_type, count(v.id) as visits").
			Table("open_content_activities oca").
			Joins("LEFT JOIN videos v ON v.id = oca.content_id AND v.open_content_provider_id = oca.open_content_provider_id").
			Joins(`LEFT JOIN facility_visibility_statuses fvs on fvs.open_content_provider_id = v.open_content_provider_id
				and fvs.content_id = v.id
				and fvs.facility_id = ?`, id).
			Where("oca.facility_id = ? and fvs.visibility_status = TRUE", id).
			Group("fvs.visibility_status, v.title, v.url, v.thumbnail_url, v.open_content_provider_id, v.id").
			Having("count(v.id) > 0"),
		db.Select("fvs.visibility_status, l.title, l.url, l.thumbnail_url, l.open_content_provider_id, l.id as content_id, 'library' as content_type, count(l.id) as visits").
			Table("open_content_activities oca").
			Joins("LEFT JOIN libraries l on l.id = oca.content_id AND l.open_content_provider_id = oca.open_content_provider_id and l.deleted_at is null").
			Joins(`LEFT JOIN facility_visibility_statuses fvs on fvs.open_content_provider_id = l.open_content_provider_id
				and fvs.content_id = l.id
				and fvs.facility_id = ?`, id).
			Where("oca.facility_id = ? and fvs.visibility_status = TRUE", id).
			Group("fvs.visibility_status, l.title, l.url, l.thumbnail_url, l.open_content_provider_id, l.id").
			Having("count(l.id) > 0"),
	).Find(&content).Error; err != nil {
		return nil, newGetRecordsDBError(err, "open_content_items")
	}
	return content, nil
}

func (db *DB) GetTopUserOpenContent(id int, args *models.QueryContext) ([]models.OpenContentItem, error) {
	var content []models.OpenContentItem
	if err := db.WithContext(args.Ctx).Raw("? UNION ? ORDER BY visits DESC LIMIT 5",
		db.Select("fvs.visibility_status, v.title, v.url, v.thumbnail_url, v.open_content_provider_id, v.id as content_id, 'video' as content_type, count(v.id) as visits").
			Table("open_content_activities oca").
			Joins("LEFT JOIN videos v ON v.id = oca.content_id AND v.open_content_provider_id = oca.open_content_provider_id ").
			Joins("LEFT JOIN facility_visibility_statuses fvs ON fvs.open_content_provider_id = v.open_content_provider_id AND fvs.content_id = v.id AND fvs.facility_id = ?", args.FacilityID).
			Where("oca.user_id = ? and fvs.visibility_status = TRUE", id).
			Group("fvs.visibility_status, v.title, v.url, v.thumbnail_url, v.open_content_provider_id, v.id").
			Having("count(v.id) > 0"),
		db.Select("fvs.visibility_status, l.title, l.url, l.thumbnail_url, l.open_content_provider_id, l.id as content_id, 'library' as content_type, count(l.id) as visits").
			Table("open_content_activities oca").
			Joins("LEFT JOIN libraries l on l.id = oca.content_id AND l.open_content_provider_id = oca.open_content_provider_id and l.deleted_at is null").
			Joins(`LEFT JOIN facility_visibility_statuses fvs on fvs.open_content_provider_id = l.open_content_provider_id
				and fvs.content_id = l.id
				and fvs.facility_id = ?`, args.FacilityID).
			Where("oca.user_id = ? and fvs.visibility_status = TRUE", id).
			Group("fvs.visibility_status, l.title, l.url, l.thumbnail_url, l.open_content_provider_id, l.id").
			Having("count(l.id) > 0"),
	).Find(&content).Error; err != nil {
		return nil, newGetRecordsDBError(err, "open_content_items")
	}
	return content, nil
}

func (db *DB) GetTopFacilityLibraries(args *models.QueryContext, id int, perPage int, days int) ([]models.OpenContentItem, error) {
	libraries := make([]models.OpenContentItem, 0, perPage)
	daysAgo := time.Now().AddDate(0, 0, -days)
	tx := db.WithContext(args.Ctx).Table("open_content_activities oca").
		Select("l.title, l.url, l.thumbnail_url as thumbnail_url, l.open_content_provider_id, l.id as content_id, 'library' as type, count(l.id) as visits").
		Joins("JOIN libraries l on l.id = oca.content_id AND l.open_content_provider_id = oca.open_content_provider_id and l.deleted_at is null").
		Where("oca.facility_id = ?", id)
	if days != -1 {
		tx = tx.Where("oca.request_ts >= ?", daysAgo)
	}
	if err := tx.
		Group("l.title, l.url, l.thumbnail_url, l.open_content_provider_id, l.id").
		Order("visits DESC").
		Limit(perPage).
		Find(&libraries).
		Error; err != nil {
		return nil, newGetRecordsDBError(err, "libraries")
	}
	return libraries, nil
}

type OpenContentResponse struct {
	models.OpenContentItem
	IsFeatured   bool    `json:"is_featured"`
	TotalHours   float64 `json:"total_hours"`
	TotalMinutes float64 `json:"total_minutes"`
}

func (db *DB) GetTopFiveLibrariesByUserID(userID int, args *models.QueryContext) ([]OpenContentResponse, error) {
	libraries := make([]OpenContentResponse, 0, 5)
	query := db.WithContext(args.Ctx).Table("libraries lib ").
		Select(`lib.id as content_id,lib.title,
			lib.url,
			lib.thumbnail_url,
			CASE WHEN fvs.visibility_status IS NULL THEN false
				ELSE fvs.visibility_status
			END AS visibility_status,
			lib.open_content_provider_id, 
			CASE WHEN ocf.facility_id IS NOT NULL AND ocf.facility_id = u.facility_id THEN true
				ELSE false
			END as is_featured,
			SUM(EXTRACT(EPOCH FROM oca.duration) / 3600) AS total_hours,
			SUM(EXTRACT(EPOCH FROM oca.duration) / 60) AS total_minutes
		`).
		Joins(`join open_content_providers ocp ON ocp.id = lib.open_content_provider_id
				AND ocp.currently_enabled = TRUE
				AND ocp.deleted_at IS NULL`).
		Joins(`join open_content_activities oca on oca.open_content_provider_id = ocp.id
				and oca.content_id = lib.id`).
		Joins(`join users u on u.id = oca.user_id
				and u.id = ?`, userID).
		Joins(`left outer join open_content_favorites ocf on ocf.open_content_provider_id = ocp.id
				and ocf.content_id = lib.id
				and ocf.facility_id IS NOT NULL`).
		Joins(`left outer join facility_visibility_statuses fvs on fvs.open_content_provider_id = lib.open_content_provider_id
			and fvs.content_id = lib.id
			and fvs.facility_id = ?`, args.FacilityID).
		Where("oca.user_id = ?", userID).
		Group("lib.title, lib.url, lib.thumbnail_url, fvs.visibility_status, lib.open_content_provider_id, ocf.facility_id, u.facility_id, lib.id").
		Order("8 desc")
	if err := query.Find(&libraries).Error; err != nil {
		return nil, NewDBError(err, "error getting top 5 libraries")
	}
	return libraries, nil
}

func (db *DB) GetMostRecentFiveVideosByUserID(userID int) ([]OpenContentResponse, error) {
	videos := make([]OpenContentResponse, 0, 5)
	query := `with RecentVideos as (
		select oca.content_id
		from videos vid
		join open_content_providers ocp on ocp.id = vid.open_content_provider_id
			and ocp.currently_enabled = true
			and ocp.deleted_at IS NULL
		join open_content_activities oca on oca.content_id = vid.id
			and oca.open_content_provider_id = ocp.id
		where oca.user_id = ?
		and oca.request_ts = (
			select max(sub_oca.request_ts)
			from open_content_activities sub_oca
			where sub_oca.content_id = oca.content_id
			and sub_oca.user_id = oca.user_id
		)
		order by oca.request_ts desc
		limit 5
	),
	VideoWatchTime as (
		select oca.content_id,
		SUM(EXTRACT(EPOCH FROM oca.duration) / 60) AS total_minutes
		from open_content_activities oca
		join open_content_providers ocp on ocp.id = oca.open_content_provider_id
			and ocp.currently_enabled = true
			and ocp.deleted_at IS NULL
		join videos vid on vid.id = oca.content_id
			and vid.open_content_provider_id = ocp.id
		where oca.content_id in (select content_id from RecentVideos)
			and oca.user_id = ?
		group by oca.content_id
	)
	select vid.title, vid.url,
		vid.thumbnail_url,vid.description,
		vid.channel_title,
		vwt.total_minutes,
		vwt.total_minutes / 60 as total_hours
	from videos vid
	join VideoWatchTime vwt on vwt.content_id = vid.id
	order by vwt.total_minutes desc
	limit 5`

	if err := db.Raw(query, userID, userID).Scan(&videos).Error; err != nil {
		return nil, err
	}
	return videos, nil
}

func (db *DB) BookmarkOpenContent(params *models.OpenContentParams) error {
	if params.Name != "" {
		var activity models.OpenContentActivity
		if err := db.Model(&models.OpenContentActivity{}).
			Where("user_id = ? AND content_id = ? AND open_content_provider_id = ?",
				params.UserID, params.ContentID, params.OpenContentProviderID).
			Order("request_ts DESC").
			First(&activity).Error; err != nil {
			log.Infof("activity %v", activity)
			return newNotFoundDBError(err, "open_content_activities")
		}
		newFav := models.OpenContentFavorite{
			UserID:                params.UserID,
			ContentID:             params.ContentID,
			OpenContentProviderID: params.OpenContentProviderID,
			Name:                  params.Name,
			OpenContentUrlID:      &activity.OpenContentUrlID,
		}
		if err := db.Create(&newFav).Error; err != nil {
			return newNotFoundDBError(err, "open_content_favorites")
		}
	} else if params.ContentURL != "" {
		var url models.OpenContentUrl
		if err := db.Model(&models.OpenContentUrl{}).
			Where("content_url = ?", params.ContentURL).
			First(&url).Error; err != nil {
			log.Infof("No matching URL found for %s", params.ContentURL)
			return newNotFoundDBError(err, "open_content_urls")
		}
		if err := db.Where("user_id = ? AND content_id = ? AND open_content_url_id = ? AND open_content_provider_id = ?",
			params.UserID, params.ContentID, &url.ID, params.OpenContentProviderID).
			Delete(&models.OpenContentFavorite{}).Error; err != nil {
			return newNotFoundDBError(err, "open_content_favorites")
		}
	} else {
		return fmt.Errorf("invalid parameters: must provide either Name or ContentURL")
	}
	return nil
}
