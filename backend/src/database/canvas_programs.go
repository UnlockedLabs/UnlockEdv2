package database

import (
	"UnlockEdv2/src/models"

	"gorm.io/gorm"
)

// GetCanvasMappedUsers resolves a slice of Canvas external user IDs to their local
// user records via provider_user_mappings. When facilityID is non-zero only users
// in that facility are returned.
func (db *DB) GetCanvasMappedUsers(providerID uint, canvasUserIDs []string, facilityID uint) ([]models.CanvasMappedUser, error) {
	var rows []models.CanvasMappedUser
	q := db.Model(&models.ProviderUserMapping{}).
		Select("provider_user_mappings.external_user_id, provider_user_mappings.user_id, users.name_first, users.name_last, users.doc_id").
		Joins("JOIN users ON users.id = provider_user_mappings.user_id").
		Where("provider_user_mappings.provider_platform_id = ? AND provider_user_mappings.external_user_id IN ? AND users.deleted_at IS NULL", providerID, canvasUserIDs)
	if facilityID != 0 {
		q = q.Where("users.facility_id = ?", facilityID)
	}
	if err := q.Scan(&rows).Error; err != nil {
		return nil, newGetRecordsDBError(err, "canvas_mapped_users")
	}
	return rows, nil
}

// CountProviderUserMappings returns the total number of user mappings for a provider.
func (db *DB) CountProviderUserMappings(providerID uint) (int64, error) {
	var count int64
	if err := db.Model(&models.ProviderUserMapping{}).
		Where("provider_platform_id = ?", providerID).
		Count(&count).Error; err != nil {
		return 0, newGetRecordsDBError(err, "provider_user_mappings")
	}
	return count, nil
}

// CountProviderEnrollments returns (active, total) enrollment counts for a Canvas provider.
// Both counts exclude soft-deleted users. Active excludes soft-deleted mappings;
// total includes soft-deleted mappings (all-time) but still requires the user record
// to be present (not soft-deleted).
// When facilityID is non-zero only users belonging to that facility are counted.
func (db *DB) CountProviderEnrollments(providerID uint, facilityID uint) (active, total int64, err error) {
	base := func(unscoped bool) *gorm.DB {
		var q *gorm.DB
		if unscoped {
			q = db.Unscoped().Model(&models.ProviderUserMapping{})
		} else {
			q = db.Model(&models.ProviderUserMapping{})
		}
		q = q.Joins("JOIN users ON users.id = provider_user_mappings.user_id").
			Where("provider_user_mappings.provider_platform_id = ? AND users.deleted_at IS NULL", providerID)
		if facilityID != 0 {
			q = q.Where("users.facility_id = ?", facilityID)
		}
		return q
	}
	if err = base(false).Count(&active).Error; err != nil {
		return 0, 0, newGetRecordsDBError(err, "provider_user_mappings")
	}
	if err = base(true).Count(&total).Error; err != nil {
		return 0, 0, newGetRecordsDBError(err, "provider_user_mappings")
	}
	return active, total, nil
}

// CountCanvasMappedEnrollees returns how many of the given Canvas external user IDs
// have a ProviderUserMapping for the specified provider.
func (db *DB) CountCanvasMappedEnrollees(providerID uint, canvasUserIDs []string) (int64, error) {
	var count int64
	if err := db.Model(&models.ProviderUserMapping{}).
		Joins("JOIN users ON users.id = provider_user_mappings.user_id").
		Where("provider_user_mappings.provider_platform_id = ? AND provider_user_mappings.external_user_id IN ? AND users.deleted_at IS NULL", providerID, canvasUserIDs).
		Count(&count).Error; err != nil {
		return 0, newGetRecordsDBError(err, "provider_user_mappings")
	}
	return count, nil
}

// CountCanvasMappedEnrolleesForFacility is like CountCanvasMappedEnrollees but
// scoped to users belonging to the given facility.
func (db *DB) CountCanvasMappedEnrolleesForFacility(providerID uint, canvasUserIDs []string, facilityID uint) (int64, error) {
	var count int64
	if err := db.Model(&models.ProviderUserMapping{}).
		Joins("JOIN users ON users.id = provider_user_mappings.user_id").
		Where("provider_user_mappings.provider_platform_id = ? AND provider_user_mappings.external_user_id IN ? AND users.facility_id = ? AND users.deleted_at IS NULL",
			providerID, canvasUserIDs, facilityID).
		Count(&count).Error; err != nil {
		return 0, newGetRecordsDBError(err, "provider_user_mappings")
	}
	return count, nil
}

// CountCanvasMappedEnrolleesPerFacility returns a map of facility_id → count of
// mapped users from that facility for the given Canvas external user IDs.
func (db *DB) CountCanvasMappedEnrolleesPerFacility(providerID uint, canvasUserIDs []string) (map[uint]int64, error) {
	type facilityCount struct {
		FacilityID uint  `gorm:"column:facility_id"`
		Count      int64 `gorm:"column:count"`
	}
	var rows []facilityCount
	if err := db.Raw(`
		SELECT u.facility_id, COUNT(*) AS count
		FROM provider_user_mappings pum
		JOIN users u ON u.id = pum.user_id
		WHERE pum.provider_platform_id = ? AND pum.external_user_id IN ?
		  AND pum.deleted_at IS NULL AND u.deleted_at IS NULL
		GROUP BY u.facility_id
	`, providerID, canvasUserIDs).Scan(&rows).Error; err != nil {
		return nil, newGetRecordsDBError(err, "provider_user_mappings")
	}
	result := make(map[uint]int64, len(rows))
	for _, r := range rows {
		result[r.FacilityID] = r.Count
	}
	return result, nil
}
