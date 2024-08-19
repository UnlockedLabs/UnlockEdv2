package database

import (
	"UnlockEdv2/src/models"
	"errors"
	"fmt"
	"strings"
)

func (db *DB) CreateProviderUserMapping(providerUserMapping *models.ProviderUserMapping) error {
	return db.Conn.Create(providerUserMapping).Error
}

func (db *DB) GetProviderUserMappingByExternalUserID(externalUserID string, providerId uint) (*models.ProviderUserMapping, error) {
	var providerUserMapping models.ProviderUserMapping
	if err := db.Conn.Where("external_user_id = ? AND provider_platform_id = ?", externalUserID, providerId).First(&providerUserMapping).Error; err != nil {
		return nil, err
	}
	return &providerUserMapping, nil
}

func (db *DB) GetUserMappingsForProvider(providerId uint) ([]models.ProviderUserMapping, error) {
	var users []models.ProviderUserMapping
	if err := db.Conn.Find(&users).Where("provider_platform_id = ?", providerId).Error; err != nil {
		return nil, err
	}
	return users, nil
}

func (db *DB) GetProviderUserMapping(userID, providerID int) (*models.ProviderUserMapping, error) {
	var providerUserMapping models.ProviderUserMapping
	if err := db.Conn.Where("user_id = ? AND provider_platform_id = ?", userID, providerID).First(&providerUserMapping).Error; err != nil {
		return nil, err
	}
	return &providerUserMapping, nil
}

func (db *DB) UpdateProviderUserMapping(providerUserMapping *models.ProviderUserMapping) error {
	result := db.Conn.Model(&models.ProviderUserMapping{}).Where("id = ?", providerUserMapping.ID).Updates(providerUserMapping)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("provider user mapping not found")
	}
	return nil
}

func (db *DB) GetUnmappedUsers(page, perPage int, providerID string, userSearch []string, facilityId uint) (int64, []models.User, error) {
	var users []models.User
	var total int64

	if providerID == "" {
		return 0, nil, errors.New("no provider id provided to search unmapped users")
	}

	if len(userSearch) != 0 {
		fmt.Println("getting unmapped users, searching for ", userSearch)
		users, err := db.getUnmappedProviderUsersWithSearch(providerID, userSearch, facilityId)
		if err != nil {
			return 0, nil, err
		}
		return int64(len(users)), users, nil
	}

	if err := db.Conn.Table("users").Select("*").
		Where("users.role = ?", "student").
		Where("users.id NOT IN (SELECT user_id FROM provider_user_mappings WHERE provider_platform_id = ?)", providerID).
		Where("facility_id = ?", fmt.Sprintf("%d", facilityId)).
		Count(&total).
		Offset((page - 1) * perPage).
		Limit(perPage).
		Find(&users).Error; err != nil {
		return 0, nil, err
	}

	return total, users, nil
}

func (db *DB) getUnmappedProviderUsersWithSearch(providerID string, userSearch []string, facilityId uint) ([]models.User, error) {
	var users []models.User
	tx := db.Conn.Table("users u").Select("u.*").
		Where("u.role = ?", "student").
		Where("u.id NOT IN (SELECT user_id FROM provider_user_mappings WHERE provider_platform_id = ?)", providerID).
		Where("facility_id = ?", fmt.Sprintf("%d", facilityId))

	searchCondition := db.Conn
	for _, search := range userSearch {
		split := strings.Split(search, " ")
		if len(split) > 1 {
			first := "%" + strings.TrimSpace(strings.ToLower(split[0])) + "%"
			last := "%" + strings.TrimSpace(strings.ToLower(split[1])) + "%"
			searchCondition = searchCondition.Or(db.Conn.Where("u.name_first ILIKE ? OR u.name_last ILIKE ?", first, first).Or("u.name_first ILIKE ? OR u.name_last ILIKE ?", last, last))
			continue
		}
		search = "%" + strings.TrimSpace(strings.ToLower(search)) + "%"
		if strings.Contains(search, "@") {
			searchCondition = searchCondition.Or("u.email ILIKE ?", search)
			continue
		}
		searchCondition = searchCondition.Or("u.name_first ILIKE ?", search).Or("u.name_last ILIKE ?", search).Or("u.username ILIKE ?", search)
	}

	tx = tx.Where(searchCondition)

	if err := tx.Find(&users).Error; err != nil {
		return nil, err
	}

	fmt.Printf("found %d matches", len(users))
	return users, nil
}

func (db *DB) GetAllProviderMappingsForUser(userID int) ([]models.ProviderUserMapping, error) {
	var providerUserMappings []models.ProviderUserMapping
	if err := db.Conn.Where("user_id = ?", userID).Find(&providerUserMappings).Error; err != nil {
		return nil, err
	}
	return providerUserMappings, nil
}

func (db *DB) DeleteProviderUserMappingByUserID(userID, providerID int) error {
	result := db.Conn.Model(&models.ProviderUserMapping{}).Where("user_id = ? AND provider_platform_id = ?", userID, providerID).Delete(&models.ProviderUserMapping{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("provider user mapping not found")
	}
	return nil
}
