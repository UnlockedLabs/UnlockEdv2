package database

import (
	"UnlockEdv2/src/models"
	"strings"

	"gorm.io/gorm"
)

func (db *DB) CreateProviderUserMapping(providerUserMapping *models.ProviderUserMapping) error {
	if err := db.Create(providerUserMapping).Error; err != nil {
		return newCreateDBError(err, "provider_user_mappings")
	}
	return nil
}

func (db *DB) GetProviderUserMapping(userID, providerID int) (*models.ProviderUserMapping, error) {
	var providerUserMapping models.ProviderUserMapping
	if err := db.Model(&models.ProviderUserMapping{}).
		First(&providerUserMapping, "user_id = ? AND provider_platform_id = ?", userID, providerID).
		Error; err != nil {
		return nil, newNotFoundDBError(err, "provider_user_mappings")
	}
	return &providerUserMapping, nil
}

func (db *DB) UpdateProviderUserMapping(providerUserMapping *models.ProviderUserMapping) error {
	result := db.Model(&models.ProviderUserMapping{}).Where("id = ?", providerUserMapping.ID).Updates(providerUserMapping)
	if result.Error != nil {
		return newUpdateDBError(result.Error, "provider_user_mappings")
	}
	if result.RowsAffected == 0 {
		return newUpdateDBError(gorm.ErrRecordNotFound, "provider_user_mappings")
	}
	return nil
}

func (db *DB) GetUnmappedUsers(args *models.QueryContext, providerID int, userSearch []string) ([]models.User, error) {
	var users []models.User
	tx := db.Model(&models.User{}).
		Where("role = ? AND id NOT IN (?)",
			"student",
			db.Model(&models.ProviderUserMapping{}).Select("user_id").Where("provider_platform_id = ?", providerID),
		)
	if args.FacilityID != 0 {
		tx = tx.Where("facility_id = ?", args.FacilityID)
	}

	if len(userSearch) > 0 {
		tx = applyUserSearchConditions(tx, userSearch)
	}
	if err := tx.Count(&args.Total).Error; err != nil {
		return nil, NewDBError(err, "error counting unmapped users")
	}
	if err := tx.Offset(args.CalcOffset()).Limit(args.PerPage).Find(&users).Error; err != nil {
		return nil, NewDBError(err, "error getting unmapped users")
	}
	return users, nil
}

func (db *DB) GetAllUnmappedUsers(providerID int, facilityID uint) ([]models.User, error) {
	var users []models.User
	tx := db.Model(&models.User{}).
		Where(
			"role = ? AND id NOT IN (?)",
			"student",
			db.Model(&models.ProviderUserMapping{}).
				Select("user_id").
				Where("provider_platform_id = ?", providerID),
		)
	if facilityID != 0 {
		tx = tx.Where("facility_id = ?", facilityID)
	}
	if err := tx.Find(&users).Error; err != nil {
		return nil, NewDBError(err, "error getting all unmapped users")
	}
	return users, nil
}

func applyUserSearchConditions(tx *gorm.DB, userSearch []string) *gorm.DB {
	var conditions []string
	var args []interface{}

	for _, search := range userSearch {
		search = strings.TrimSpace(search)
		if search == "" {
			continue
		}
		searchTerm := "%" + strings.ToLower(search) + "%"

		if strings.Contains(search, "@") {
			conditions = append(conditions, "LOWER(email) LIKE ?")
			args = append(args, searchTerm)
		} else if strings.Contains(search, " ") {
			splitNames := strings.Fields(search)
			for _, namePart := range splitNames {
				nameTerm := "%" + strings.ToLower(namePart) + "%"
				conditions = append(conditions, "(LOWER(name_first) LIKE ? OR LOWER(name_last) LIKE ?)")
				args = append(args, nameTerm, nameTerm)
			}
		} else {
			conditions = append(conditions, "(LOWER(name_first) LIKE ? OR LOWER(name_last) LIKE ? OR LOWER(username) LIKE ?)")
			args = append(args, searchTerm, searchTerm, searchTerm)
		}
	}

	if len(conditions) > 0 {
		combinedCondition := "(" + strings.Join(conditions, " OR ") + ")"
		tx = tx.Where(combinedCondition, args...)
	}
	return tx
}

func (db *DB) GetAllProviderMappingsForUser(userID int) ([]models.ProviderUserMapping, error) {
	var providerUserMappings []models.ProviderUserMapping
	if err := db.Model(&models.ProviderUserMapping{}).Find(&providerUserMappings, "user_id = ?", userID).Error; err != nil {
		return nil, newGetRecordsDBError(err, "provider_user_mappings")
	}
	return providerUserMappings, nil
}

func (db *DB) GetMappedUsers(args *models.QueryContext, providerID int) ([]models.User, error) {
	var users []models.User
	tx := db.Model(&models.User{}).
		Where("id IN (?)",
			db.Model(&models.ProviderUserMapping{}).Select("user_id").Where("provider_platform_id = ?", providerID),
		)
	if args.FacilityID != 0 {
		tx = tx.Where("facility_id = ?", args.FacilityID)
	}
	if err := tx.Count(&args.Total).Error; err != nil {
		return nil, NewDBError(err, "error counting mapped users")
	}
	if err := tx.Offset(args.CalcOffset()).Limit(args.PerPage).Find(&users).Error; err != nil {
		return nil, NewDBError(err, "error getting mapped users")
	}
	return users, nil
}

// GetMappedUsersExternalIDs returns a map of user_id → external_user_id for all
// users mapped to the given provider platform. Used to join with live Canvas data.
func (db *DB) GetMappedUsersExternalIDs(providerID int) (map[uint]string, error) {
	var rows []struct {
		UserID         uint   `gorm:"column:user_id"`
		ExternalUserID string `gorm:"column:external_user_id"`
	}
	if err := db.Model(&models.ProviderUserMapping{}).
		Select("user_id, external_user_id").
		Where("provider_platform_id = ?", providerID).
		Find(&rows).Error; err != nil {
		return nil, NewDBError(err, "error getting mapped user external IDs")
	}
	result := make(map[uint]string, len(rows))
	for _, row := range rows {
		result[row.UserID] = row.ExternalUserID
	}
	return result, nil
}

func (db *DB) DeleteProviderUserMappingByUserID(userID, providerID int) error {
	result := db.Model(&models.ProviderUserMapping{}).Where("user_id = ? AND provider_platform_id = ?", userID, providerID).Delete(&models.ProviderUserMapping{})
	if result.Error != nil {
		return newDeleteDBError(result.Error, "provider_user_mappings")
	}
	if result.RowsAffected == 0 {
		return newDeleteDBError(gorm.ErrRecordNotFound, "provider_user_mappings")
	}
	return nil
}
