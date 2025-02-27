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
// categoryIds - the category ids to filter the libraries by
func (db *DB) GetAllLibraries(args *models.QueryContext, visibility string, categoryIds []int) ([]LibraryResponse, error) {
	var (
		criteria string
		id       uint
	)
	libraries := make([]LibraryResponse, 0, args.PerPage)
	//added the below to display featuring flags for all admins per facility
	selectIsFavoriteOrIsFeatured := `
        libraries.*,
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
	tx := db.Model(&models.Library{}).Preload("OpenContentProvider").Select(fmt.Sprintf(selectIsFavoriteOrIsFeatured, criteria), id)
	visibility = strings.ToLower(visibility)

	isFeatured := false
	switch visibility {
	case "featured":
		// Join with open_content_favorites, ensuring facility_id is not null (admin-specific)
		tx = tx.Joins(`JOIN open_content_favorites f 
			ON f.content_id = libraries.id 
			AND f.open_content_provider_id = libraries.open_content_provider_id 
			AND f.facility_id IS NOT NULL`).Where("f.facility_id = ? AND visibility_status = true", args.FacilityID)
		isFeatured = true
	case "visible":
		tx = tx.Where("visibility_status = true")
	case "hidden":
		tx = tx.Where("visibility_status = false")
	case "all":
	default:
		tx = tx.Where("visibility_status = true")
	}
	var search string
	if args.Search != "" {
		search = "%" + strings.ToLower(args.Search) + "%"
		tx = tx.Where("LOWER(libraries.title) LIKE ? OR LOWER(libraries.description) LIKE ?", search, search)
	}
	if len(categoryIds) > 0 {
		tx = tx.Joins("JOIN open_content_types t ON t.content_id = libraries.id").Where("t.category_id IN (?) AND t.open_content_provider_id = libraries.open_content_provider_id", categoryIds)
	}
	if err := tx.Count(&args.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "libraries")
	}

	switch args.OrderBy {
	case "most_popular":
		tx = tx.Select(`
            libraries.*,
            COUNT(f.id) AS favorite_count,
            EXISTS (
                SELECT 1
                FROM open_content_favorites f
                WHERE f.content_id = libraries.id
                  AND f.open_content_provider_id = libraries.open_content_provider_id
                  AND f.user_id = ?
            ) AS is_favorited`, args.UserID)
		if !isFeatured {
			tx = tx.Joins(`LEFT JOIN open_content_favorites f 
				ON f.content_id = libraries.id 
				AND f.open_content_provider_id = libraries.open_content_provider_id`)
		}
		tx = tx.Group("libraries.id").Order("favorite_count DESC")
	default:
		tx = tx.Order(args.OrderBy)
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

func (db *DB) OpenContentTitleSearch(search string) ([]models.OpenContentItem, error) {
	var items []models.OpenContentItem
	searchQuery := `SELECT
			'video' AS content_type,
			v.id as content_id,
			v.title,
			CONCAT('/viewer/videos/', v.id) as url,
			v.thumbnail_url,
			v.description,
			v.visibility_status,
			v.open_content_provider_id,
			NULL AS provider_name,
			v.channel_title,
			v.created_at
		   FROM videos v
		   WHERE to_tsvector('english', v.title || ' ' || v.description || ' ' || v.channel_title) @@ plainto_tsquery('english', ?)
		   UNION ALL
		SELECT
			'library' AS content_type,
			l.id as content_id,
			l.title,
			CONCAT('/api/proxy/libraries/', l.id) as url,
			l.thumbnail_url,
			l.description,
			l.visibility_status,
			l.open_content_provider_id,
			'kiwix' AS provider_name,
			NULL AS channel_title,
			l.created_at
		    FROM libraries l
		    WHERE to_tsvector('english', l.title || ' ' || l.description) @@ plainto_tsquery('english', ?);`

	tx := db.Raw(searchQuery, search, search)
	if err := tx.Scan(&items).Error; err != nil {
		log.Errorln("Unable to perform content search")
		return nil, newNotFoundDBError(err, "content search")
	}
	return items, nil
}

func (db *DB) GetLibrariesByIDs(ids []int) ([]models.Library, error) {
	var libraries []models.Library
	tx := db.Preload("OpenContentProvider").Where("id in ?", ids)
	if len(ids) > 1 {
		tx.Where("language = 'eng'")
	}
	if err := tx.Find(&libraries).Error; err != nil {
		log.Errorln("unable to find libraries with these IDs")
		return nil, newNotFoundDBError(err, "libraries")
	}
	return libraries, nil
}

func (db *DB) ToggleVisibilityAndRetrieveLibrary(id int) (*models.Library, error) {
	var library models.Library
	if err := db.Preload("OpenContentProvider").Find(&library, "id = ?", id).Error; err != nil {
		log.Errorln("Unable to find library with that ID")
		return nil, newNotFoundDBError(err, "libraries")
	}
	library.VisibilityStatus = !library.VisibilityStatus
	if err := db.Save(&library).Error; err != nil {
		return nil, newUpdateDBError(err, "libraries")
	}
	return &library, nil
}
