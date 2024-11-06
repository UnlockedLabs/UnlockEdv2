package database

import (
	"UnlockEdv2/src/models"
	"fmt"

	log "github.com/sirupsen/logrus"
)

func (db *DB) GetAllFacilities(page, itemsPerPage int) (int64, []models.Facility, error) {
	var total int64
	offset := (page - 1) * itemsPerPage
	var facilities []models.Facility
	if err := db.Model(&models.Facility{}).Count(&total).Limit(itemsPerPage).Offset(offset).Find(&facilities).Error; err != nil {
		return total, nil, newGetRecordsDBError(err, "facilities")
	}
	return total, facilities, nil
}

func (db *DB) GetFacilityByID(id int) (*models.Facility, error) {
	var facility models.Facility
	if err := db.Where("id = ?", fmt.Sprintf("%d", id)).First(&facility).Error; err != nil {
		return nil, newNotFoundDBError(err, "facilities")
	}
	return &facility, nil
}

func (db *DB) CreateFacility(facility *models.Facility) error {
	if err := Validate().Struct(facility); err != nil {
		log.Error("Validation Error")
		return NewDBError(err, "facilities")
	}

	if err := db.Create(&facility).Error; err != nil {
		log.Error("error creating facility in database")
		return newCreateDBError(err, "facilities")
	}
	return nil
}

func (db *DB) UpdateFacility(facility *models.Facility, id uint) error {
	if err := db.Model(models.Facility{}).Where("id = ?", id).Updates(&facility).Error; err != nil {
		log.WithField("facility_id", facility.ID).Error("error updating facility name database/UpdateFacility")
		return newUpdateDBError(err, "facilities")
	}
	return nil
}

func (db *DB) DeleteFacility(id int) error {
	if err := db.Delete(&models.Facility{}, "id = ?", fmt.Sprintf("%d", id)).Error; err != nil {
		return newDeleteDBError(err, "facilities")
	}
	return nil
}
