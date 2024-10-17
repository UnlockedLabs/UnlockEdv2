package database

import (
	"UnlockEdv2/src/models"
	"fmt"

	log "github.com/sirupsen/logrus"
)

func (db *DB) GetAllFacilities() ([]models.Facility, error) {
	var facilities []models.Facility
	if err := db.Model(&models.Facility{}).Find(&facilities).Error; err != nil {
		return nil, newGetRecordsDBError(err, "facilities")
	}
	return facilities, nil
}

func (db *DB) GetFacilityByID(id int) (*models.Facility, error) {
	var facility models.Facility
	if err := db.Where("id = ?", fmt.Sprintf("%d", id)).First(&facility).Error; err != nil {
		return nil, newNotFoundDBError(err, "facilities")
	}
	return &facility, nil
}

func (db *DB) CreateFacility(facility *models.Facility) error {
	if err := db.Create(&facility).Error; err != nil {
		log.Error("error creating facility in database")
		return newCreateDBError(err, "facilities")
	}
	return nil
}

func (db *DB) UpdateFacility(name string, id uint) (*models.Facility, error) {
	if err := db.Model(models.Facility{}).Where("id = ?", fmt.Sprintf("%d", id)).Update("name", name).Error; err != nil {
		log.WithField("facility_id", id).Error("error updating facility name database/UpdateFacility")
		return nil, newUpdateDBError(err, "facilities")
	}
	facility := &models.Facility{}
	if err := db.Model(models.Facility{}).Find(facility, "id = ?", fmt.Sprintf("%d", id)).Error; err != nil {
		return nil, newUpdateDBError(err, "facilities")
	}
	return facility, nil
}

func (db *DB) DeleteFacility(id int) error {
	if err := db.Delete(&models.Facility{}, "id = ?", fmt.Sprintf("%d", id)).Error; err != nil {
		return newDeleteDBError(err, "facilities")
	}
	return nil
}
