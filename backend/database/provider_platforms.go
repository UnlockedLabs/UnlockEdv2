package database

import (
	"backend/models"
	"fmt"
	"log"
)

func (db *DB) GetAllProviderPlatforms(page, perPage int) (int64, []models.ProviderPlatform, error) {
	var platforms []models.ProviderPlatform
	var total int64
	if err := db.Conn.Model(&models.ProviderPlatform{}).Count(&total).Error; err != nil {
		return 0, nil, err
	}
	if err := db.Conn.Offset((page-1)*perPage).
		Where("is_deleted = ?", false).
		Limit(perPage).
		Find(&platforms).Error; err != nil {
		return 0, nil, err
	}
	return total, platforms, nil
}

func (db *DB) GetProviderPlatformByID(id int) (models.ProviderPlatform, error) {
	var platform models.ProviderPlatform
	if err := db.Conn.First(&platform, fmt.Sprintf("%d", id)).Error; err != nil {
		return models.ProviderPlatform{}, err
	}
	return platform, nil
}

func (db *DB) CreateProviderPlatform(platform models.ProviderPlatform) error {
	if err := db.Conn.Create(&platform).Error; err != nil {
		return err
	}
	return nil
}

func (db *DB) UpdateProviderPlatform(platform models.ProviderPlatform, id int) error {
	log.Printf("Updating provider platform with ID: %d", id)
	var existingPlatform models.ProviderPlatform
	if err := db.Conn.First(&existingPlatform, id).Error; err != nil {
		return err
	}
	if platform.Name != "" {
		existingPlatform.Name = platform.Name
	}
	if platform.Description != "" {
		existingPlatform.Description = platform.Description
	}
	if platform.BaseUrl != "" {
		existingPlatform.BaseUrl = platform.BaseUrl
	}
	if platform.IconUrl != "" {
		existingPlatform.IconUrl = platform.IconUrl
	}
	if platform.Type != "" {
		existingPlatform.Type = platform.Type
	}
	if platform.AccessKey != "" {
		key, err := platform.EncryptAccessKey()
		if err != nil {
			log.Printf("Error encrypting access key: %v", err)
			return err
		}
		existingPlatform.AccessKey = key
	}
	if platform.State != "" {
		existingPlatform.State = platform.State
	}
	if err := db.Conn.Save(&existingPlatform).Error; err != nil {
		return err
	}
	return nil
}

func (db *DB) DeleteProviderPlatform(id int) error {
	log.Printf("Deleting provider platform with ID: %d", id)
	if err := db.Conn.Delete(&models.ProviderPlatform{}, fmt.Sprintf("%d", id)).Error; err != nil {
		return err
	}
	return nil
}
