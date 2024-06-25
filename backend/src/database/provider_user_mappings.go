package database

import (
	"UnlockEdv2/src/models"
	"errors"
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

func (db *DB) GetUnmappedUsers(page, perPage int, providerID, userSearch string) (int64, []models.User, error) {
	var users []models.User
	var total int64
	if providerID != "" {
		if userSearch != "" {
			users, err := db.getUnmappedProviderUsersWithSearch(providerID, userSearch)
			if err != nil {
				return 0, nil, err
			}
			return int64(len(users)), users, nil
		}
		if err := db.Conn.Table("users").Select("*").Where("users.id NOT IN (SELECT user_id FROM provider_user_mappings WHERE provider_platform_id = ?)", providerID).Find(&users).Error; err != nil {
			return 0, nil, err
		}
		return total, users, nil
	} else {
		if userSearch != "" {
			usrs, err := db.getAllUnmappedProviderUsersSearch(userSearch)
			if err != nil {
				return 0, nil, err
			}
			return int64(len(usrs)), usrs, nil
		}
	}
	if err := db.Conn.Table("users u").Where("u.id NOT IN (SELECT user_id FROM provider_user_mappings)").Find(&users).Count(&total).Error; err != nil {
		return 0, nil, err
	}
	return total, users, nil
}

func (db *DB) getAllUnmappedProviderUsersSearch(userSearch string) ([]models.User, error) {
	var users []models.User
	if err := db.Conn.Table("users u").Select("u.*").Where("u.id NOT IN (SELECT user_id FROM provider_user_mappings)").Where("u.email ILIKE ?", "%"+strings.ToLower(userSearch)+"%").
		Or("u.name_first ILIKE ?", "%"+strings.ToLower(userSearch)+"%").Or("u.name_last ILIKE ?", "%"+strings.ToLower(userSearch)+"%").Find(&users).Error; err != nil {
		return nil, err
	}
	if len(users) == 0 {
		return users, db.Conn.Table("users u").Select("u.*").Where("u.id NOT IN (SELECT user_id FROM provider_user_mappings)").Find(&users).Error
	}
	return users, nil
}

func (db *DB) getUnmappedProviderUsersWithSearch(providerID, userSearch string) ([]models.User, error) {
	var users []models.User
	if err := db.Conn.Table("users u").Select("u.*").Where("u.id NOT IN (SELECT user_id FROM provider_user_mappings WHERE provider_platform_id = ?)", providerID).Where("u.email ILIKE ?", "%"+strings.ToLower(userSearch)+"%").
		Or("u.name_first ILIKE ?", "%"+strings.ToLower(userSearch)+"%").Or("u.name_last ILIKE ?", "%"+strings.ToLower(userSearch)+"%").Find(&users).Error; err != nil {
		return nil, err
	}
	if len(users) == 0 {
		return users, db.Conn.Table("users u").Select("u.*").Where("u.id NOT IN (SELECT user_id FROM provider_user_mappings)").Find(&users).Error
	}
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
