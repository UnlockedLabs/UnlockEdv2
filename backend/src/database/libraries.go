package database

import (
	"UnlockEdv2/src/models"
	"fmt"
	"strings"

	log "github.com/sirupsen/logrus"
)

type LibraryResponse struct {
	models.Library
	IsFavorited bool `json:"is_favorited"`
}

// Retrieves either a paginated list of libraries or all libraries based upon the given parameters.
// page - the page number for pagination
// perPage - the number of libraries to display on page
// userId - the userId for which libraries to display for
// facilityId - the facility id of where the libraries were favorited
// visibility - can either be featured, visible, hidden, or all
// orderBy - the order in which the results are returned
// isAdmin - true or false on whether the user is an administrator used to determine how to retrieve featured libraries
// all - true or false on whether or not to return all libraries without pagination
// tagIds - the tag ids to filter the libraries by
func (db *DB) GetAllLibraries(args *models.QueryContext, visibility string) ([]LibraryResponse, error) {
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
	tx := db.WithContext(args.Ctx).Model(&models.Library{}).Preload("OpenContentProvider").Select(fmt.Sprintf(selectIsFavoriteOrIsFeatured, criteria), id)
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
		tx = tx.Order(args.OrderClause("libraries"))
	}
	if !args.All {
		tx = tx.Limit(args.PerPage).Offset(args.CalcOffset())
	}
	if err := tx.Find(&libraries).Error; err != nil {
		return nil, newGetRecordsDBError(err, "libraries")
	}
	return libraries, nil
}

func (db *DB) GetLibraryByID(id int) (*models.Library, error) {
	var library models.Library
	if err := db.Preload("OpenContentProvider").First(&library, "id = ?", id).Error; err != nil {
		log.Errorln("Unable to find library with that ID")
		return nil, newNotFoundDBError(err, "libraries")
	}
	return &library, nil
}

func (db *DB) OpenContentTitleSearch(args *models.QueryContext) ([]models.OpenContentItem, error) {
	var items []models.OpenContentItem
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
				and to_tsvector('english', v.title || ' ' || v.description || ' ' || v.channel_title) @@ plainto_tsquery('english', ?)
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
			and to_tsvector('english', l.title || ' ' || l.description) @@ plainto_tsquery('english', ?)`

	tx := db.WithContext(args.Ctx).Raw(searchQuery, args.FacilityID, args.Search, args.FacilityID, args.Search)
	if err := tx.Scan(&items).Error; err != nil {
		log.Errorln("Unable to perform content search")
		return nil, newNotFoundDBError(err, "content search")
	}
	return items, nil
}

func (db *DB) GetLibrariesByIDsAndLang(ids []int, language string) ([]models.Library, error) {
	var libraries []models.Library
	tx := db.Preload("OpenContentProvider").Where("id in ?", ids)
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
func (db *DB) GetAllLibrariesByLang(args *models.QueryContext, language string) ([]models.Library, error) {
	var libraries []models.Library
	tx := db.WithContext(args.Ctx).Model(&models.Library{}).Preload("OpenContentProvider").Select("libraries.*").
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

func (db *DB) ToggleVisibilityAndRetrieveLibrary(id int, args *models.QueryContext) (*models.Library, error) {
	var library models.Library
	query := db.WithContext(args.Ctx).Model(&models.Library{}).Preload("OpenContentProvider").
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
	if err := db.Save(&visibility).Error; err != nil {
		return nil, newUpdateDBError(err, "libraries")
	}
	library.VisibilityStatus = visibility.VisibilityStatus
	return &library, nil
}
