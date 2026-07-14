package database

import (
	"UnlockEdv2/src/models"

	"gorm.io/gorm/clause"
)

type OpenContentMeta struct {
	IsFavorited          bool `json:"is_favorited"`
	IsFeatured           bool `json:"is_featured"`
	VisibleFacilityCount int  `json:"visible_facility_count"`
}

type ContentFacilityVisibility struct {
	FacilityID       uint   `json:"facility_id"`
	FacilityName     string `json:"facility_name"`
	VisibilityStatus bool   `json:"visibility_status"`
}

func (db *DB) getContentFacilityVisibility(args *models.QueryContext, contentID, providerID uint) ([]ContentFacilityVisibility, error) {
	visibilities := make([]ContentFacilityVisibility, 0, 12)
	if err := db.WithContext(args.Ctx).Table("facilities f").
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

func (db *DB) UpsertFacilityVisibilityStatuses(args *models.QueryContext, statuses []models.FacilityVisibilityStatus, visible bool) error {
	if len(statuses) == 0 {
		return nil
	}
	updateMap := map[string]any{"visibility_status": visible}
	if args.UserID != 0 {
		updateMap["update_user_id"] = args.UserID
	}
	if err := db.WithContext(args.Ctx).Clauses(clause.OnConflict{
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
