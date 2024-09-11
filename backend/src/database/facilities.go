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

func (db *DB) CreateFacility(name string) (*models.Facility, error) {
	log.Infoln("Creating facility:" + name)
	facility := models.Facility{Name: name}
	if err := db.Create(&facility).Error; err != nil {
		log.WithField("facility_name", name).Error("error creating facility in database")
		return nil, newCreateDBError(err, "facilities")
	}
	newFacility := models.Facility{}
	if err := db.Model(models.Facility{}).Find(&newFacility, "name = ?", name).Error; err != nil {
		return nil, newCreateDBError(err, "facilities")
	}
	return &newFacility, nil
}

func (db *DB) UpdateFacility(name string, id uint) (*models.Facility, error) {
	if err := db.Model(models.Facility{}).Where("id = ?", fmt.Sprintf("%d", id)).Update("name", name).Error; err != nil {
		log.WithField("facility_id", id).Error("error updating facility name database/UpdateFacility")
		return nil, newUpdateDBrror(err, "facilities")
	}
	facility := &models.Facility{}
	if err := db.Model(models.Facility{}).Find(facility, "id = ?", fmt.Sprintf("%d", id)).Error; err != nil {
		return nil, newUpdateDBrror(err, "facilities")
	}
	return facility, nil
}

func (db *DB) DeleteFacility(id int) error {
	if err := db.Delete(&models.Facility{}, "id = ?", fmt.Sprintf("%d", id)).Error; err != nil {
		return newDeleteDBError(err, "facilities")
	}
	return nil
}
