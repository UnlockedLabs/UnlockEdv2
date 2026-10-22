package opencontent

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/UnlockedLabs/unlocked-contracts/features"
	"github.com/UnlockedLabs/unlocked-contracts/identity"
	"github.com/UnlockedLabs/unlocked-contracts/jobs"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// store holds every Open Content database query. The queries moved from core's
// database package unchanged (EN-192). A method that takes ctx records the
// caller as the create or update user; one without writes no user.
type store struct{ db *gorm.DB }

// OpenContentMeta is what a list adds to each library, video or link for the
// caller.
type OpenContentMeta struct {
	IsFavorited          bool `json:"is_favorited"`
	IsFeatured           bool `json:"is_featured"`
	VisibleFacilityCount int  `json:"visible_facility_count"`
}

// ContentFacilityVisibility is whether one facility shows a library, video or
// link.
type ContentFacilityVisibility struct {
	FacilityID       uint   `json:"facility_id"`
	FacilityName     string `json:"facility_name"`
	VisibilityStatus bool   `json:"visibility_status"`
}

type LibraryResponse struct {
	Library
	OpenContentMeta
	Tags []string `json:"tags" gorm:"-"`
}

type VideoResponse struct {
	Video
	OpenContentMeta
}

type HelpfulLinkResp struct {
	HelpfulLink
	OpenContentMeta
}

// Facility visibility

func (s *store) getContentFacilityVisibility(args *queryContext, contentID, providerID uint) ([]ContentFacilityVisibility, error) {
	visibilities := make([]ContentFacilityVisibility, 0, 12)
	if err := s.db.WithContext(args.Ctx).Table("facilities f").
		Select(`f.id AS facility_id, f.name AS facility_name,
			COALESCE(fvs.visibility_status, false) AS visibility_status`).
		Joins(`LEFT JOIN facility_visibility_statuses fvs ON fvs.facility_id = f.id
			AND fvs.content_id = ? AND fvs.open_content_provider_id = ?`,
			contentID, providerID).
		Where("f.deleted_at IS NULL").
		Order("f.name asc").
		Scan(&visibilities).Error; err != nil {
		return nil, newGetRecordsDBError(err, "facility_visibility_statuses")
	}
	return visibilities, nil
}

func (s *store) UpsertFacilityVisibilityStatuses(args *queryContext, statuses []FacilityVisibilityStatus, visible bool) error {
	if len(statuses) == 0 {
		return nil
	}
	updateMap := map[string]any{"visibility_status": visible}
	if args.UserID != 0 {
		updateMap["update_user_id"] = args.UserID
	}
	if err := s.db.WithContext(args.Ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "facility_id"}, {Name: "open_content_provider_id"}, {Name: "content_id"}},
		DoUpdates: clause.Assignments(updateMap),
	}).Create(&statuses).Error; err != nil {
		return newUpdateDBError(err, "facility_visibility_statuses")
	}
	return nil
}

// SQL fragment computing how many non-deleted facilities have this row visible.
func visibleFacilityCountSubquery(table string) string {
	return `(
		SELECT COUNT(*)
		FROM facility_visibility_statuses v
		JOIN facilities fac ON fac.id = v.facility_id AND fac.deleted_at IS NULL
		WHERE v.content_id = ` + table + `.id
			AND v.open_content_provider_id = ` + table + `.open_content_provider_id
			AND v.visibility_status = true
	) AS visible_facility_count`
}

// Libraries

// Retrieves either a paginated list of libraries or all libraries based upon the given parameters.
// visibility - can either be featured, visible, hidden, or all
func (s *store) GetAllLibraries(args *queryContext, visibility string) ([]LibraryResponse, error) {
	var (
		criteria string
		id       uint
	)
	libraries := make([]LibraryResponse, 0, args.PerPage)
	//added the below to display featuring flags for all admins per facility
	selectIsFavoriteOrIsFeatured := `
		libraries.*,
		CASE WHEN fvs.visibility_status IS NULL THEN false
			ELSE fvs.visibility_status
		END AS visibility_status,
		` + visibleFacilityCountSubquery("libraries") + `,
		EXISTS (
			SELECT 1
			FROM open_content_favorites ff
			WHERE ff.content_id = libraries.id
				AND ff.open_content_provider_id = libraries.open_content_provider_id
				AND ff.open_content_url_id IS NULL
				AND ff.facility_id = ?
		) AS is_featured,
		EXISTS (
			SELECT 1
			FROM open_content_favorites f
			WHERE f.content_id = libraries.id
				AND f.open_content_provider_id = libraries.open_content_provider_id
            AND f.open_content_url_id IS NULL
			  AND %s) AS is_favorited`

	if args.IsAdmin {
		criteria, id = "f.facility_id = ?", args.FacilityID
	} else {
		criteria, id = "f.user_id = ?", args.UserID
	}
	tx := s.db.WithContext(args.Ctx).Model(&Library{}).Preload("OpenContentProvider").Select(fmt.Sprintf(selectIsFavoriteOrIsFeatured, criteria), args.FacilityID, id)
	tx = tx.Joins(`left outer join facility_visibility_statuses fvs on fvs.open_content_provider_id = libraries.open_content_provider_id
		and fvs.content_id = libraries.id
		and fvs.facility_id = ?`, args.FacilityID)
	visibility = strings.ToLower(visibility)

	isFeatured := false
	switch visibility {
	case "featured":
		// Join with open_content_favorites, ensuring facility_id is not null (admin-specific)
		tx = tx.Joins(`JOIN open_content_favorites f
			ON f.content_id = libraries.id
			AND f.open_content_provider_id = libraries.open_content_provider_id
			AND f.facility_id IS NOT NULL`).Where("f.facility_id = ? AND fvs.visibility_status = true", args.FacilityID)
		isFeatured = true
	case "visible":
		tx = tx.Where("fvs.visibility_status = true")
	case "hidden":
		tx = tx.Where("(fvs.visibility_status = false OR fvs.visibility_status IS NULL)")
	case "all":
	default:
		tx = tx.Where("fvs.visibility_status = true")
	}
	var search string
	if args.Search != "" {
		search = args.SearchQuery()
		tx = tx.Where("LOWER(libraries.title) LIKE ? OR LOWER(libraries.description) LIKE ?", search, search)
	}
	if len(args.Tags) > 0 {
		tx = tx.Joins("JOIN open_content_tags t ON t.content_id = libraries.id").Where("t.tag_id IN (?) AND t.open_content_provider_id = libraries.open_content_provider_id", args.Tags)
	}
	if err := tx.Count(&args.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "libraries")
	}

	switch args.OrderBy {
	case "most_popular":
		tx = tx.Select(`
			libraries.*,
			CASE WHEN fvs.visibility_status IS NULL THEN false
				ELSE fvs.visibility_status
			END AS visibility_status,
			COUNT(f.id) AS favorite_count,
			EXISTS (
				SELECT 1
				FROM open_content_favorites f
				WHERE f.content_id = libraries.id
					AND f.open_content_provider_id = libraries.open_content_provider_id
					AND f.user_id = ?
			) AS is_favorited`, args.UserID)
		if !isFeatured {
			tx = tx.Joins(`JOIN open_content_favorites f
				ON f.content_id = libraries.id
				AND f.open_content_provider_id = libraries.open_content_provider_id
				AND f.facility_id IS NULL`)
		}
		tx = tx.Group("libraries.id, fvs.visibility_status").Order("favorite_count DESC")
	default:
		tx = tx.Order(args.OrderClause("libraries.created_at desc"))
	}
	if !args.All {
		tx = tx.Limit(args.PerPage).Offset(args.CalcOffset())
	}
	if err := tx.Find(&libraries).Error; err != nil {
		return nil, newGetRecordsDBError(err, "libraries")
	}
	if len(libraries) > 0 {
		libraryIDs := make([]uint, len(libraries))
		for i, lib := range libraries {
			libraryIDs[i] = lib.ID
		}
		type tagRow struct {
			ContentID uint
			TagName   string
		}
		var rows []tagRow
		if err := s.db.WithContext(args.Ctx).Raw(
			`SELECT oct.content_id, t.name AS tag_name
			 FROM open_content_tags oct
			 JOIN tags t ON t.id = oct.tag_id
			 WHERE oct.content_id IN ?`, libraryIDs,
		).Scan(&rows).Error; err != nil {
			log.Warnf("failed to fetch tags for libraries: %v", err)
		} else {
			tagMap := make(map[uint][]string)
			for _, r := range rows {
				tagMap[r.ContentID] = append(tagMap[r.ContentID], r.TagName)
			}
			for i := range libraries {
				if tags, ok := tagMap[libraries[i].ID]; ok {
					libraries[i].Tags = tags
				}
			}
		}
	}
	return libraries, nil
}

func (s *store) GetLibraryByID(id int) (*Library, error) {
	var library Library
	if err := s.db.Preload("OpenContentProvider").First(&library, "id = ?", id).Error; err != nil {
		log.Errorln("Unable to find library with that ID")
		return nil, newNotFoundDBError(err, "libraries")
	}
	return &library, nil
}

func (s *store) OpenContentTitleSearch(args *queryContext) ([]OpenContentItem, error) {
	var items []OpenContentItem
	searchQuery := `SELECT
			'video' AS content_type,
			v.id as content_id,
			v.title,
			CONCAT('/viewer/videos/', v.id) as url,
			v.thumbnail_url,
			v.description,
			(CASE WHEN fvs.visibility_status is null then false else fvs.visibility_status END) as visibility_status,
			v.open_content_provider_id,
			NULL AS provider_name,
			v.channel_title,
			v.created_at
			FROM videos v
        LEFT OUTER JOIN facility_visibility_statuses fvs
            on fvs.open_content_provider_id = v.open_content_provider_id
            and fvs.content_id = v.id
            and fvs.facility_id = ?
        WHERE fvs.visibility_status = true
				and to_tsvector('english', concat_ws(' ', v.title, v.description, v.channel_title)) @@ plainto_tsquery('english', ?)
		   UNION ALL
		SELECT
			'library' AS content_type,
			l.id as content_id,
			l.title,
			CONCAT('/api/proxy/libraries/', l.id) as url,
			l.thumbnail_url,
			l.description,
			CASE WHEN fvs.visibility_status IS NULL THEN false
				ELSE fvs.visibility_status
			END AS visibility_status,
			l.open_content_provider_id,
			'kiwix' AS provider_name,
			NULL AS channel_title,
			l.created_at
		FROM libraries l
		left outer join facility_visibility_statuses fvs on fvs.open_content_provider_id = l.open_content_provider_id
			and fvs.content_id = l.id
			and fvs.facility_id = ?
		WHERE fvs.visibility_status = true
			and to_tsvector('english', concat_ws(' ', l.title, l.description)) @@ plainto_tsquery('english', ?)`

	tx := s.db.WithContext(args.Ctx).Raw(searchQuery, args.FacilityID, args.Search, args.FacilityID, args.Search)
	if err := tx.Scan(&items).Error; err != nil {
		log.Errorln("Unable to perform content search")
		return nil, newNotFoundDBError(err, "content search")
	}
	return items, nil
}

func (s *store) GetLibrariesByIDsAndLang(ids []int, language string) ([]Library, error) {
	var libraries []Library
	tx := s.db.Preload("OpenContentProvider").Where("id in ?", ids)
	if len(ids) > 1 {
		tx.Where("language = ?", language)
	}
	if err := tx.Find(&libraries).Error; err != nil {
		log.Errorln("unable to find libraries with these IDs with language as ", language)
		return nil, newNotFoundDBError(err, "libraries")
	}
	return libraries, nil
}

// Retrieves all libraries by langauge using the given paramenters. A way to find out the different language values is to execute
// an SQL query against the libraries table to see the different language values (column name is language).
// language - the language of the library to retrieve
func (s *store) GetAllLibrariesByLang(args *queryContext, language string) ([]Library, error) {
	var libraries []Library
	tx := s.db.WithContext(args.Ctx).Model(&Library{}).Preload("OpenContentProvider").Select("libraries.*").
		Joins(`left outer join facility_visibility_statuses fvs on fvs.open_content_provider_id = libraries.open_content_provider_id
			and fvs.content_id = libraries.id
			and fvs.facility_id = ?`, args.FacilityID).
		Where("fvs.visibility_status = true and libraries.language = ?", language)
	if err := tx.Find(&libraries).Error; err != nil {
		log.Errorln("unable to find libraries that are visible with language as ", language)
		return nil, newNotFoundDBError(err, "libraries")
	}
	return libraries, nil
}

func (s *store) ToggleVisibilityAndRetrieveLibrary(id int, args *queryContext) (*Library, error) {
	var library Library
	query := s.db.WithContext(args.Ctx).Model(&Library{}).Preload("OpenContentProvider").
		Select("libraries.*, fvs.visibility_status").
		Joins(`left outer join facility_visibility_statuses fvs on fvs.open_content_provider_id = libraries.open_content_provider_id
			and fvs.content_id = libraries.id
			and fvs.facility_id = ?`, args.FacilityID)
	if err := query.Find(&library, "id = ?", id).Error; err != nil {
		log.Errorln("Unable to find library with that ID")
		return nil, newNotFoundDBError(err, "libraries")
	}
	visibility := library.GetFacilityVisibilityStatus(args.FacilityID)
	visibility.VisibilityStatus = !visibility.VisibilityStatus

	updateMap := map[string]any{
		"visibility_status": visibility.VisibilityStatus,
	}
	if args.UserID != 0 {
		updateMap["update_user_id"] = args.UserID
	}
	if err := s.db.WithContext(args.Ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "facility_id"}, {Name: "open_content_provider_id"}, {Name: "content_id"}},
		DoUpdates: clause.Assignments(updateMap),
	}).Create(&visibility).Error; err != nil {
		return nil, newUpdateDBError(err, "libraries")
	}
	library.VisibilityStatus = visibility.VisibilityStatus
	return &library, nil
}

func (s *store) GetLibraryFacilityVisibility(args *queryContext, id int) ([]ContentFacilityVisibility, error) {
	var library Library
	if err := s.db.WithContext(args.Ctx).First(&library, "id = ?", id).Error; err != nil {
		return nil, newNotFoundDBError(err, "libraries")
	}
	return s.getContentFacilityVisibility(args, library.ID, library.OpenContentProviderID)
}

// findLibraryProxy is the library the proxy forwards to, with its visibility
// at facilityID.
func (s *store) findLibraryProxy(id string, facilityID uint) (*Library, bool) {
	var library Library
	query := s.db.Model(&Library{}).Preload("OpenContentProvider").
		Select("libraries.*, fvs.visibility_status").
		Joins(`left outer join facility_visibility_statuses fvs on fvs.open_content_provider_id = libraries.open_content_provider_id
					and fvs.content_id = libraries.id
					and fvs.facility_id = ?`, facilityID)
	if query.First(&library, "id = ?", id).RowsAffected == 0 {
		return nil, false
	}
	return &library, true
}

// Tags

func (s *store) GetTags() ([]Tag, error) {
	var tags []Tag
	if err := s.db.Model(&Tag{}).Find(&tags).Error; err != nil {
		return nil, newNotFoundDBError(err, "tags")
	}
	return tags, nil
}

// Videos

func (s *store) GetVideoByID(id int, facilityId uint) (*Video, error) {
	var video Video
	query := s.db.Model(&Video{}).Preload("Attempts").
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

// findVideoProxy is the video the proxy serves. A non-admin only gets a
// video that is available and visible at their facility.
func (s *store) findVideoProxy(id string, facilityID uint, isAdmin bool) (*Video, error) {
	var video Video
	tx := s.db.Model(&Video{}).
		Select(`videos.*,
            (CASE WHEN fvs.visibility_status IS NULL THEN false ELSE fvs.visibility_status END) AS visibility_status`).
		Joins(`LEFT OUTER JOIN facility_visibility_statuses fvs
            ON fvs.open_content_provider_id = videos.open_content_provider_id
            AND fvs.content_id = videos.id
            AND fvs.facility_id = ?`, facilityID).
		Where("videos.id = ?", id)
	if isAdmin {
		tx = tx.First(&video)
	} else {
		tx = tx.First(&video, "fvs.visibility_status = true AND availability = 'available'")
	}
	if err := tx.Error; err != nil {
		return nil, err
	}
	return &video, nil
}

func (s *store) GetVideoProvider() (*OpenContentProvider, error) {
	var provider OpenContentProvider
	if err := s.db.First(&provider, "title = ?", Youtube).Error; err != nil {
		return nil, newNotFoundDBError(err, "open_content_providers")
	}
	return &provider, nil
}

// JobProviderID is the first enabled provider of the kind that runs job:
// Kiwix for the library jobs, YouTube for the video jobs. It's zero if none
// is enabled.
func (s *store) JobProviderID(ctx context.Context, job jobs.Type) (uint, error) {
	title := Youtube
	if job.IsLibraryJob() {
		title = Kiwix
	}
	providers := make([]OpenContentProvider, 0, 2)
	if err := s.db.WithContext(ctx).Find(&providers, "currently_enabled = true").Error; err != nil {
		return 0, newGetRecordsDBError(err, "open_content_providers")
	}
	for _, p := range providers {
		if formatNullableString(p.Title) == title {
			return p.ID, nil
		}
	}
	return 0, nil
}

// Jobs: the queries the worker's jobs run (worker.go).

// GetJobProvider is the content provider a job message names. An ID with no
// row gives an empty provider, not an error.
func (s *store) GetJobProvider(ctx context.Context, id int) (*OpenContentProvider, error) {
	var provider OpenContentProvider
	if err := s.db.WithContext(ctx).Find(&provider, id).Error; err != nil {
		return nil, newGetRecordsDBError(err, "open_content_providers")
	}
	return &provider, nil
}

// UpsertLibrary saves lib, or updates the library with lib's external ID.
func (s *store) UpsertLibrary(ctx context.Context, lib *Library) error {
	if err := s.db.WithContext(ctx).
		Where(&Library{ExternalID: lib.ExternalID}).
		Assign(Library{
			Url:          lib.Url,
			Title:        lib.Title,
			Description:  lib.Description,
			Language:     lib.Language,
			ThumbnailUrl: lib.ThumbnailUrl,
		}).
		FirstOrCreate(lib).Error; err != nil {
		return newUpdateDBError(err, "libraries")
	}
	return nil
}

// DeleteLibrariesNotIn deletes the provider's libraries whose external ID
// isn't in externalIDs, and returns how many it deleted.
func (s *store) DeleteLibrariesNotIn(ctx context.Context, providerID uint, externalIDs []string) (int64, error) {
	tx := s.db.WithContext(ctx).Where("open_content_provider_id = ?", providerID).Delete(&Library{}, "external_id NOT IN (?)", externalIDs)
	if tx.Error != nil {
		return 0, newDeleteDBError(tx.Error, "libraries")
	}
	return tx.RowsAffected, nil
}

func (s *store) CountVideos(ctx context.Context) (int64, error) {
	var count int64
	if err := s.db.WithContext(ctx).Model(&Video{}).Count(&count).Error; err != nil {
		return 0, newGetRecordsDBError(err, "videos")
	}
	return count, nil
}

// GetSavedVideoExternalIDs is the external IDs in externalIDs that have a
// saved video.
func (s *store) GetSavedVideoExternalIDs(ctx context.Context, externalIDs []string) ([]string, error) {
	var saved []string
	if err := s.db.WithContext(ctx).Model(&Video{}).Where("external_id IN ?", externalIDs).Pluck("external_id", &saved).Error; err != nil {
		return nil, newGetRecordsDBError(err, "videos")
	}
	return saved, nil
}

// GetVideosNotIn is the saved videos whose external ID isn't in externalIDs.
func (s *store) GetVideosNotIn(ctx context.Context, externalIDs []string) ([]Video, error) {
	var videos []Video
	if err := s.db.WithContext(ctx).Model(&Video{}).Where("external_id NOT IN ?", externalIDs).Find(&videos).Error; err != nil {
		return nil, newGetRecordsDBError(err, "videos")
	}
	return videos, nil
}

// GetUnavailableVideos is the videos still processing or that failed.
func (s *store) GetUnavailableVideos(ctx context.Context) ([]Video, error) {
	videos := make([]Video, 0)
	if err := s.db.WithContext(ctx).Model(&Video{}).Find(&videos, "availability <> 'available'").Error; err != nil {
		return nil, newGetRecordsDBError(err, "videos")
	}
	return videos, nil
}

// GetVideoWithAttempts is a video and its download attempts.
func (s *store) GetVideoWithAttempts(ctx context.Context, id int) (*Video, error) {
	var video Video
	if err := s.db.WithContext(ctx).Preload("Attempts").First(&video, id).Error; err != nil {
		return nil, newNotFoundDBError(err, "videos")
	}
	return &video, nil
}

func (s *store) VideoExternalIDExists(ctx context.Context, externalID string) (bool, error) {
	return s.videoExists(ctx, "external_id = ?", externalID)
}

func (s *store) VideoURLExists(ctx context.Context, url string) (bool, error) {
	return s.videoExists(ctx, "url = ?", url)
}

func (s *store) videoExists(ctx context.Context, query string, arg string) (bool, error) {
	var exists bool
	if err := s.db.WithContext(ctx).Model(&Video{}).Select("count(*) > 0").Where(query, arg).Scan(&exists).Error; err != nil {
		return false, newGetRecordsDBError(err, "videos")
	}
	return exists, nil
}

func (s *store) CreateVideo(ctx context.Context, video *Video) error {
	if err := s.db.WithContext(ctx).Create(video).Error; err != nil {
		return newCreateDBError(err, "videos")
	}
	return nil
}

func (s *store) SaveVideo(ctx context.Context, video *Video) error {
	if err := s.db.WithContext(ctx).Save(video).Error; err != nil {
		return newUpdateDBError(err, "videos")
	}
	return nil
}

func (s *store) CountVideoDownloadAttempts(ctx context.Context, videoID uint) (int64, error) {
	var count int64
	if err := s.db.WithContext(ctx).Model(&VideoDownloadAttempt{}).Where("video_id = ?", videoID).Count(&count).Error; err != nil {
		return 0, newGetRecordsDBError(err, "video_download_attempts")
	}
	return count, nil
}

func (s *store) CreateVideoDownloadAttempt(ctx context.Context, attempt *VideoDownloadAttempt) error {
	if err := s.db.WithContext(ctx).Create(attempt).Error; err != nil {
		return newCreateDBError(err, "video_download_attempts")
	}
	return nil
}

func (s *store) FavoriteOpenContent(contentID int, ocpID uint, userID uint, facilityID *uint) (bool, error) {
	fav := OpenContentFavorite{
		ContentID:             uint(contentID),
		OpenContentProviderID: ocpID,
		UserID:                userID,
		FacilityID:            facilityID,
	}
	//added user id to query below to isolate favorite by user when facility id is passed in
	tx := s.db.Where("content_id = ? AND open_content_provider_id = ?", contentID, ocpID).
		Where("open_content_url_id IS NULL OR name IS NULL OR name = ''")
	if facilityID != nil {
		tx = tx.Where("facility_id = ?", facilityID)
	} else {
		tx = tx.Where("user_id = ?", userID)
	}
	if tx.First(&OpenContentFavorite{}).RowsAffected > 0 {
		delTx := s.db.Where("content_id = ? AND open_content_provider_id = ?  ", contentID, ocpID).
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
		if err := s.db.Create(&fav).Error; err != nil {
			return false, newCreateDBError(err, "open_content_favorites")
		}
		return true, nil
	}
}

func (s *store) GetAllVideos(args *queryContext, visibility string) ([]VideoResponse, error) {
	var videos []VideoResponse
	tx := s.db.WithContext(args.Ctx).Model(&Video{}).Preload("Attempts").Select(`
	videos.*,
        CASE WHEN fvs.visibility_status is null then false
        else fvs.visibility_status
    end as visibility_status,
	`+visibleFacilityCountSubquery("videos")+`,
	EXISTS (
		SELECT 1
		FROM open_content_favorites f
		WHERE f.content_id = videos.id
		  AND f.open_content_provider_id = videos.open_content_provider_id
		  AND f.user_id = ?
	) AS is_favorited,
	EXISTS (
		SELECT 1
		FROM open_content_favorites ff
		WHERE ff.content_id = videos.id
		  AND ff.open_content_provider_id = videos.open_content_provider_id
		  AND ff.facility_id = ?
	) AS is_featured`, args.UserID, args.FacilityID).
		Joins(`left join facility_visibility_statuses fvs
        on fvs.open_content_provider_id = videos.open_content_provider_id
        and fvs.content_id = videos.id
        and fvs.facility_id = ?`, args.FacilityID)

	switch visibility {
	case "visible":
		tx = tx.Where("COALESCE(fvs.visibility_status, false) = ?", true)
	case "hidden":
		tx = tx.Where("COALESCE(fvs.visibility_status, false) = ?", false)
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

func (s *store) ToggleVideoVisibility(ctx context.Context, id int, facilityId uint) error {
	var video Video
	query := s.db.WithContext(ctx).Model(&Video{}).
		Select("videos.*, fvs.visibility_status").
		Joins(`left outer join facility_visibility_statuses fvs on fvs.open_content_provider_id = videos.open_content_provider_id
			and fvs.content_id = videos.id
			and fvs.facility_id = ?`, facilityId)
	if err := query.Find(&video, "videos.id = ?", id).Error; err != nil {
		return newNotFoundDBError(err, "videos")
	}
	visibility := video.GetFacilityVisibilityStatus(facilityId)
	visibility.VisibilityStatus = !visibility.VisibilityStatus
	updateMap := map[string]any{
		"visibility_status": visibility.VisibilityStatus,
	}
	if c, ok := identity.FromContext(ctx); ok {
		updateMap["update_user_id"] = c.UserID
	}
	if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "facility_id"}, {Name: "open_content_provider_id"}, {Name: "content_id"}},
		DoUpdates: clause.Assignments(updateMap),
	}).Create(&visibility).Error; err != nil {
		return newUpdateDBError(err, "video visibility")
	}

	return nil
}

func (s *store) GetVideoFacilityVisibility(args *queryContext, id int) ([]ContentFacilityVisibility, error) {
	var video Video
	if err := s.db.WithContext(args.Ctx).First(&video, "id = ?", id).Error; err != nil {
		return nil, newNotFoundDBError(err, "videos")
	}
	return s.getContentFacilityVisibility(args, video.ID, video.OpenContentProviderID)
}

func (s *store) DeleteVideo(id int) error {
	vid := Video{}
	vid.ID = uint(id)
	if err := s.db.Delete(&vid).Error; err != nil {
		return newCreateDBError(err, "videos")
	}
	return nil
}

// Helpful links

func (s *store) GetHelpfulLinks(args *queryContext, onlyVisible bool) ([]HelpfulLinkResp, error) {
	links := make([]HelpfulLinkResp, 0, args.PerPage)

	subQuery := s.db.Table("open_content_favorites f").
		Select("1").
		Where(`f.content_id = helpful_links.id AND f.user_id = ?
			AND f.open_content_provider_id = helpful_links.open_content_provider_id`, args.UserID)
	featuredSubQuery := s.db.Table("open_content_favorites ff").
		Select("1").
		Where(`ff.content_id = helpful_links.id AND ff.facility_id = ?
			AND ff.open_content_provider_id = helpful_links.open_content_provider_id`, args.FacilityID)
	tx := s.db.Model(&HelpfulLink{}).
		Select(`helpful_links.*,
			COALESCE(fvs.visibility_status, false) AS visibility_status,
			`+visibleFacilityCountSubquery("helpful_links")+`,
			EXISTS(?) as is_favorited, EXISTS(?) as is_featured`, subQuery, featuredSubQuery).
		Joins(`LEFT JOIN facility_visibility_statuses fvs ON fvs.open_content_provider_id = helpful_links.open_content_provider_id
			AND fvs.content_id = helpful_links.id
			AND fvs.facility_id = ?`, args.FacilityID)

	if onlyVisible {
		tx = tx.Where("fvs.visibility_status = ?", true)
	}

	if args.Search != "" {
		tx.Where("LOWER(title) LIKE ?", args.SearchQuery())
	}
	switch strings.ToLower(args.OrderBy) {
	case "most_popular":
		tx = tx.Joins("LEFT JOIN open_content_favorites f ON f.content_id = helpful_links.id AND f.open_content_provider_id = helpful_links.open_content_provider_id").
			Group("helpful_links.id, fvs.visibility_status").Order("COUNT(f.id) DESC")
	default:
		tx = tx.Order(args.OrderClause("helpful_links.created_at desc"))
	}

	if err := tx.Count(&args.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "helpful_links")
	}
	if err := tx.Offset(args.CalcOffset()).Limit(args.PerPage).Find(&links).Error; err != nil {
		return nil, newGetRecordsDBError(err, "helpful_links")
	}
	return links, nil
}

func (s *store) AddHelpfulLink(ctx context.Context, args *queryContext, link *HelpfulLink) error {
	db := s.db.WithContext(ctx)
	if db.Where("url = ?", link.Url).First(&HelpfulLink{}).RowsAffected > 0 {
		return newDBError(fmt.Errorf("link already exists"), "existing_helpful_link")
	}
	if err := db.Create(link).Error; err != nil {
		return newCreateDBError(err, "helpful_links")
	}
	return s.UpsertFacilityVisibilityStatuses(args, []FacilityVisibilityStatus{{
		FacilityID:            args.FacilityID,
		OpenContentProviderID: link.OpenContentProviderID,
		ContentID:             link.ID,
		VisibilityStatus:      true,
	}}, true)
}

func (s *store) DeleteLink(ctx context.Context, id uint) error {
	db := s.db.WithContext(ctx)
	var link HelpfulLink
	if err := db.Model(&HelpfulLink{}).Where("id = ?", id).First(&link).Error; err != nil {
		return newGetRecordsDBError(err, "helpful_links")
	}
	if err := db.Unscoped().Delete(&link).Error; err != nil {
		return newDeleteDBError(err, "helpful_links")
	}
	if err := db.Where("content_id = ? AND open_content_provider_id = ?", link.ID, link.OpenContentProviderID).
		Delete(&FacilityVisibilityStatus{}).Error; err != nil {
		return newDeleteDBError(err, "facility_visibility_statuses")
	}
	return nil
}

func (s *store) EditLink(ctx context.Context, id uint, link HelpfulLink) error {
	if err := s.db.WithContext(ctx).Model(&HelpfulLink{}).Where("id = ?", id).Updates(link).Error; err != nil {
		return newUpdateDBError(err, "helpful_links")
	}
	return nil
}

func (s *store) ToggleVisibilityStatus(ctx context.Context, args *queryContext, id int) error {
	var link HelpfulLink
	if err := s.db.WithContext(ctx).Model(&HelpfulLink{}).
		Select(`helpful_links.*, COALESCE(fvs.visibility_status, false) AS visibility_status`).
		Joins(`LEFT JOIN facility_visibility_statuses fvs ON fvs.open_content_provider_id = helpful_links.open_content_provider_id
			AND fvs.content_id = helpful_links.id
			AND fvs.facility_id = ?`, args.FacilityID).
		Where("helpful_links.id = ?", id).First(&link).Error; err != nil {
		return newGetRecordsDBError(err, "helpful_links")
	}
	return s.UpsertFacilityVisibilityStatuses(args, []FacilityVisibilityStatus{{
		FacilityID:            args.FacilityID,
		OpenContentProviderID: link.OpenContentProviderID,
		ContentID:             link.ID,
		VisibilityStatus:      !link.VisibilityStatus,
	}}, !link.VisibilityStatus)
}

func (s *store) GetHelpfulLinkFacilityVisibility(args *queryContext, id int) ([]ContentFacilityVisibility, error) {
	var link HelpfulLink
	if err := s.db.WithContext(args.Ctx).First(&link, "id = ?", id).Error; err != nil {
		return nil, newNotFoundDBError(err, "helpful_links")
	}
	return s.getContentFacilityVisibility(args, link.ID, link.OpenContentProviderID)
}

func (s *store) GetLinkFromId(id uint) (*HelpfulLink, error) {
	var link HelpfulLink
	if err := s.db.Model(&HelpfulLink{}).Where("id = ?", id).First(&link).Error; err != nil {
		return nil, newGetRecordsDBError(err, "helpful_links")
	}
	return &link, nil
}

func (s *store) GetHelpfulLinkOpenContentProviderId() (uint, error) {
	var provider OpenContentProvider
	if err := s.db.Model(&OpenContentProvider{}).Where("title = ?", "HelpfulLinks").First(&provider).Error; err != nil {
		return 0, newGetRecordsDBError(err, "open_content_providers")
	}
	return provider.ID, nil
}

// Providers, activity and favorites

func (s *store) GetOpenContent(all bool) ([]OpenContentProvider, error) {
	tx := s.db.Model(&OpenContentProvider{})
	if !all {
		tx = tx.Where("currently_enabled = ?", true)
	}
	openContent := make([]OpenContentProvider, 0, 3)
	if err := tx.Find(&openContent).Error; err != nil {
		return nil, newNotFoundDBError(err, "open_content_providers")
	}
	return openContent, nil
}

func (s *store) CreateContentActivity(urlString string, activity *OpenContentActivity) {
	url := OpenContentUrl{}
	if s.db.Where("content_url = ?", urlString).First(&url).RowsAffected == 0 {
		url.ContentURL = urlString
		if err := s.db.Create(&url).Error; err != nil {
			log.Warn("unable to create content url for activity")
			return
		}
	}
	activity.OpenContentUrlID = url.ID
	if err := s.db.Create(&activity).Error; err != nil {
		log.Warn("unable to create content activity for url, ", urlString)
	}
}

func (s *store) UpdateOpenContentActivityStopTS(activityID int64) {
	if err := s.db.Model(&OpenContentActivity{}).Where("id = ?", activityID).Update("stop_ts", time.Now()).Error; err != nil {
		log.Errorf("error updating open content activity: %v", err)
	}
}

// isBookmarked reports whether the user has bookmarked the page an activity
// visited.
func (s *store) isBookmarked(activity *OpenContentActivity) bool {
	var bookmark OpenContentFavorite
	return s.db.Model(&OpenContentFavorite{}).Where("user_id = ? AND content_id = ? AND open_content_url_id = ?", activity.UserID, activity.ContentID, activity.OpenContentUrlID).First(&bookmark).RowsAffected > 0
}

// featureBranchGuard returns a SQL fragment that empties one branch of the
// favorites UNION when the caller's facility has that content type's sub-feature
// disabled. It is a constant, never user input, so it binds no arguments and
// leaves the surrounding query's positional argument list untouched.
func featureBranchGuard(args *queryContext, feature features.Access) string {
	if args.HasFeature(feature) {
		return ""
	}
	return " AND FALSE"
}

// This method will at most ever return the most recent 30 favorites (10 Libraries, 10 Videos, 10 Helpful Links)
func (s *store) GetUserFavoriteGroupings(args *queryContext) ([]OpenContentItem, error) {
	favorites := make([]OpenContentItem, 0, 30)
	favoritesQuery := fmt.Sprintf(`WITH ordered_libraries AS (
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
			%s
	),
	ordered_helpful_links AS (
		SELECT
			'helpful_link' AS content_type,
			f.content_id AS content_id,
			hl.title,
			hl.url,
			hl.thumbnail_url,
			hl.description,
			COALESCE(fvs.visibility_status, false) AS visibility_status,
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
		left outer join facility_visibility_statuses fvs on fvs.open_content_provider_id = hl.open_content_provider_id
				and fvs.content_id = hl.id
				and fvs.facility_id = ?
		WHERE f.user_id = ?
			%s
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
	)`,
		featureBranchGuard(args, features.UploadVideo),
		featureBranchGuard(args, features.HelpfulLinks))
	if err := s.db.WithContext(args.Ctx).Raw(favoritesQuery, args.FacilityID, args.UserID, args.FacilityID, args.UserID, args.FacilityID, args.UserID).Scan(&favorites).Error; err != nil {
		return nil, err
	}
	return favorites, nil
}

func (s *store) GetUserFavorites(args *queryContext) ([]OpenContentItem, error) {
	var libSearchCond, videoSearchCond, hlSearchCond string
	var searchTerm string

	if args.Search != "" {
		searchTerm = args.SearchQuery()
		libSearchCond = "AND LOWER(lib.title) LIKE ?"
		videoSearchCond = "AND LOWER(videos.title) LIKE ?"
		hlSearchCond = "AND LOWER(hl.title) LIKE ?"
	}

	// A favorited video or helpful link must not come back when its sub-feature
	// is disabled for this facility — the route can only gate on the parent
	// (open_content), which has to stay on for libraries. Appended as a literal
	// rather than by dropping the UNION branch: the query binds its arguments
	// positionally, so changing the branch count would mean re-deriving the
	// whole arg list.
	videoSearchCond += featureBranchGuard(args, features.UploadVideo)
	hlSearchCond += featureBranchGuard(args, features.HelpfulLinks)

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

	if err := s.db.WithContext(args.Ctx).Raw(countQuery, countArgs...).Scan(&args.Total).Error; err != nil {
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
	queryArgs = append(queryArgs, args.FacilityID, args.UserID)
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
            COALESCE(fvs.visibility_status, false) AS visibility_status,
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
        left outer join facility_visibility_statuses fvs on fvs.open_content_provider_id = hl.open_content_provider_id
            and fvs.content_id = hl.id
            and fvs.facility_id = ?
        WHERE f.user_id = ? %s
    ) AS all_favorites
    ORDER BY %s
	LIMIT ? OFFSET ?`, libSearchCond, videoSearchCond, hlSearchCond, args.OrderClause("all_favorites.created_at desc"))

	var favorites []OpenContentItem
	if err := s.db.WithContext(args.Ctx).Raw(favoritesQuery, queryArgs...).Scan(&favorites).Error; err != nil {
		return nil, err
	}

	return favorites, nil
}

// OpenContentParams is a bookmark to add (with a name) or remove (with a
// URL).
type OpenContentParams struct {
	Name                  string `json:"name"`
	UserID                uint   `json:"user_id"`
	ContentURL            string `json:"content_url"`
	ContentID             uint   `json:"content_id"`
	OpenContentProviderID uint   `json:"open_content_provider_id"`
}

func (s *store) BookmarkOpenContent(params *OpenContentParams) error {
	if params.Name != "" {
		var activity OpenContentActivity
		if err := s.db.Model(&OpenContentActivity{}).
			Where("user_id = ? AND content_id = ? AND open_content_provider_id = ?",
				params.UserID, params.ContentID, params.OpenContentProviderID).
			Order("request_ts DESC").
			First(&activity).Error; err != nil {
			log.Infof("activity %v", activity)
			return newNotFoundDBError(err, "open_content_activities")
		}
		newFav := OpenContentFavorite{
			UserID:                params.UserID,
			ContentID:             params.ContentID,
			OpenContentProviderID: params.OpenContentProviderID,
			Name:                  nilIfBlank(params.Name),
			OpenContentUrlID:      &activity.OpenContentUrlID,
		}
		if err := s.db.Create(&newFav).Error; err != nil {
			return newNotFoundDBError(err, "open_content_favorites")
		}
	} else if params.ContentURL != "" {
		var url OpenContentUrl
		if err := s.db.Model(&OpenContentUrl{}).
			Where("content_url = ?", params.ContentURL).
			First(&url).Error; err != nil {
			log.Infof("No matching URL found for %s", params.ContentURL)
			return newNotFoundDBError(err, "open_content_urls")
		}
		if err := s.db.Where("user_id = ? AND content_id = ? AND open_content_url_id = ? AND open_content_provider_id = ?",
			params.UserID, params.ContentID, &url.ID, params.OpenContentProviderID).
			Delete(&OpenContentFavorite{}).Error; err != nil {
			return newNotFoundDBError(err, "open_content_favorites")
		}
	} else {
		return fmt.Errorf("invalid parameters: must provide either Name or ContentURL")
	}
	return nil
}

func (s *store) GetTopFacilityOpenContent(id int) ([]OpenContentItem, error) {
	var content []OpenContentItem
	if err := s.db.Raw("? UNION ? ORDER BY visits DESC LIMIT 5",
		s.db.Select("fvs.visibility_status, v.title, v.url, v.thumbnail_url, v.open_content_provider_id, v.id as content_id, 'video' as content_type, count(v.id) as visits").
			Table("open_content_activities oca").
			Joins("LEFT JOIN videos v ON v.id = oca.content_id AND v.open_content_provider_id = oca.open_content_provider_id").
			Joins(`LEFT JOIN facility_visibility_statuses fvs on fvs.open_content_provider_id = v.open_content_provider_id
				and fvs.content_id = v.id
				and fvs.facility_id = ?`, id).
			Where("oca.facility_id = ? and fvs.visibility_status = TRUE", id).
			Group("fvs.visibility_status, v.title, v.url, v.thumbnail_url, v.open_content_provider_id, v.id").
			Having("count(v.id) > 0"),
		s.db.Select("fvs.visibility_status, l.title, l.url, l.thumbnail_url, l.open_content_provider_id, l.id as content_id, 'library' as content_type, count(l.id) as visits").
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

func (s *store) GetTopUserOpenContent(id int, args *queryContext) ([]OpenContentItem, error) {
	var content []OpenContentItem
	if err := s.db.WithContext(args.Ctx).Raw("? UNION ? ORDER BY visits DESC LIMIT 5",
		s.db.Select("fvs.visibility_status, v.title, v.url, v.thumbnail_url, v.open_content_provider_id, v.id as content_id, 'video' as content_type, count(v.id) as visits").
			Table("open_content_activities oca").
			Joins("LEFT JOIN videos v ON v.id = oca.content_id AND v.open_content_provider_id = oca.open_content_provider_id ").
			Joins("LEFT JOIN facility_visibility_statuses fvs ON fvs.open_content_provider_id = v.open_content_provider_id AND fvs.content_id = v.id AND fvs.facility_id = ?", args.FacilityID).
			Where("oca.user_id = ? and fvs.visibility_status = TRUE", id).
			Group("fvs.visibility_status, v.title, v.url, v.thumbnail_url, v.open_content_provider_id, v.id").
			Having("count(v.id) > 0"),
		s.db.Select("fvs.visibility_status, l.title, l.url, l.thumbnail_url, l.open_content_provider_id, l.id as content_id, 'library' as content_type, count(l.id) as visits").
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

func (s *store) GetTopFacilityLibraries(args *queryContext, id int, perPage int, start, end *time.Time) ([]OpenContentItem, error) {
	libraries := make([]OpenContentItem, 0, perPage)
	tx := s.db.WithContext(args.Ctx).Table("open_content_activities oca").
		Select("l.title, l.url, l.thumbnail_url as thumbnail_url, l.open_content_provider_id, l.id as content_id, 'library' as type, count(l.id) as visits").
		Joins("JOIN libraries l on l.id = oca.content_id AND l.open_content_provider_id = oca.open_content_provider_id and l.deleted_at is null").
		Where("oca.facility_id = ?", id)
	if start != nil && end != nil {
		tx = tx.Where("oca.request_ts >= ? AND oca.request_ts < ?", *start, *end)
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
