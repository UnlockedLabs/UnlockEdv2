package database

import (
	"UnlockEdv2/src/models"
	"fmt"

	log "github.com/sirupsen/logrus"
)

func (db *DB) GetAllFacilities() ([]models.Facility, error) {
	var facilities []models.Facility
	if err := db.Conn.Model(&models.Facility{}).Error; err != nil {
		return nil, err
	}
	return facilities, nil
}

func (db *DB) GetFacilityByID(id int) (*models.Facility, error) {
	var facility models.Facility
	if err := db.Conn.Where("id = ?", fmt.Sprintf("%d", id)).First(&facility).Error; err != nil {
		return nil, err
	}
	return &facility, nil
}

func (db *DB) CreateFacility(facility *models.Facility) (*models.Facility, error) {
	log.Printf("Creating facility: %v", facility)
	if err := db.Conn.Create(&facility).Error; err != nil {
		return nil, err
	}
	newFacility := models.Facility{}
	if err := db.Conn.Where("name = ?", facility.Name).First(&facility).Error; err != nil {
		return nil, err
	}
	return &newFacility, nil
}

// need to fix this
// func (db *DB) UpdateFacility(facility *models.Facility, id uint) (*models.Facility, error) {
// 	log.Printf("Updating facility with ID: %d", id)
// 	var existingFacility models.Facility
// 	if err := db.Conn.First(&existingFacility, id).Error; err != nil {
// 		return nil, err
// 	}
// 	models.UpdateStruct(&existingFacility, facility)
// 	if platform.AccessKey != "" {
// 		key, err := platform.EncryptAccessKey()
// 		if err != nil {
// 			log.Printf("Error encrypting access key: %v", err)
// 			return nil, err
// 		}
// 		existingPlatform.AccessKey = key
// 	}
// 	if platform.State != "" {
// 		existingPlatform.State = platform.State
// 	}
// 	if err := db.Conn.Save(&existingPlatform).Error; err != nil {
// 		return nil, err
// 	}
// 	return &existingPlatform, nil
// }

func (db *DB) DeleteFacility(id int) error {
	log.Printf("Deleting facility with ID: %d", id)
	if err := db.Conn.Delete(&models.Facility{}, fmt.Sprintf("%d", id)).Error; err != nil {
		return err
	}
	return nil
}
