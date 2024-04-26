package database

import (
	"backend/cmd/models"
	"errors"
)

func (db *DB) CreateProviderUserMapping(providerUserMapping *models.ProviderUserMapping) error {
	return db.Conn.Create(providerUserMapping).Error
}

func (db *DB) GetProviderUserMappingByExternalUserID(externalUserID string) (*models.ProviderUserMapping, error) {
	var providerUserMapping models.ProviderUserMapping
	if err := db.Conn.Where("external_user_id = ?", externalUserID).First(&providerUserMapping).Error; err != nil {
		return nil, err
	}
	return &providerUserMapping, nil
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
