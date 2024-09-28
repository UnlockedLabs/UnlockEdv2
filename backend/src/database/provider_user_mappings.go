package database

import (
	"UnlockEdv2/src/models"
	"fmt"
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

func (db *DB) GetUnmappedUsers(page, perPage int, providerID int, userSearch []string, facilityId uint) (int64, []models.User, error) {
	var users []models.User
	var total int64

	if len(userSearch) != 0 {
		fmt.Println("getting unmapped users, searching for ", userSearch)
		users, err := db.getUnmappedProviderUsersWithSearch(providerID, userSearch, facilityId)
		if err != nil {
			return 0, nil, err
		}
		return int64(len(users)), users, nil
	}
	if err := db.Model(&models.User{}).
		Where("facility_id = ? AND role = ? AND id NOT IN (SELECT user_id FROM provider_user_mappings WHERE provider_platform_id = ?)", facilityId, "student", providerID).
		Count(&total).Error; err != nil {
		return 0, nil, NewDBError(err, "error counting unmapped users")
	}
	if err := db.Model(&models.User{}).
		Find(&users, "facility_id = ? AND role = ? AND id NOT IN (SELECT user_id FROM provider_user_mappings WHERE provider_platform_id = ?)", facilityId, "student", providerID).
		Offset((page - 1) * perPage).
		Limit(perPage).
		Find(&users).Error; err != nil {
		return 0, nil, NewDBError(err, "error getting unmapped users")
	}
	return total, users, nil
}

func (db *DB) getUnmappedProviderUsersWithSearch(providerID int, userSearch []string, facilityId uint) ([]models.User, error) {
	var users []models.User
	tx := db.Model(&models.User{}).
		Where("facility_id = ? AND role = ? AND id NOT IN (SELECT user_id FROM provider_user_mappings WHERE provider_platform_id = ?)", facilityId, "student", providerID)

	searchCondition := db.DB
	for _, search := range userSearch {
		split := strings.Split(search, " ")
		if len(split) > 1 {
			first := "%" + strings.TrimSpace(strings.ToLower(split[0])) + "%"
			last := "%" + strings.TrimSpace(strings.ToLower(split[1])) + "%"
			searchCondition = searchCondition.Or(db.Where("name_first LIKE ? OR name_last LIKE ?", first, first).Or("name_first LIKE ? OR name_last LIKE ?", last, last))
			continue
		}
		search = "%" + strings.TrimSpace(strings.ToLower(search)) + "%"
		if strings.Contains(search, "@") {
			searchCondition = searchCondition.Or("email LIKE ?", search)
			continue
		}
		searchCondition = searchCondition.Or("name_first LIKE ?", search).Or("name_last LIKE ?", search).Or("username LIKE ?", search)
	}
	tx = tx.Where(searchCondition)

	if err := tx.Find(&users).Error; err != nil {
		return nil, NewDBError(err, "error getting unmapped provider users with search")
	}

	fmt.Printf("found %d matches", len(users))
	return users, nil
}

func (db *DB) GetAllProviderMappingsForUser(userID int) ([]models.ProviderUserMapping, error) {
	var providerUserMappings []models.ProviderUserMapping
	if err := db.Model(&models.ProviderUserMapping{}).Find(&providerUserMappings, "user_id = ?", userID).Error; err != nil {
		return nil, newGetRecordsDBError(err, "provider_user_mappings")
	}
	return providerUserMappings, nil
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
