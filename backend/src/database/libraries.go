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
	tx := db.Model(&models.Library{}).Preload("OpenContentProvider").Select(fmt.Sprintf(selectIsFavoriteOrIsFeatured, criteria), id)
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
				AND f.open_content_provider_id = libraries.open_content_provider_id`)
		}
		tx = tx.Group("libraries.id, 12").Order("favorite_count DESC")
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

func (db *DB) ToggleVisibilityAndRetrieveLibrary(id int, args *models.QueryContext) (*models.Library, error) {
	var library models.Library
	query := db.Model(&models.Library{}).Preload("OpenContentProvider").
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
