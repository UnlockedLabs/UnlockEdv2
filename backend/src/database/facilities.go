package database

import (
	"UnlockEdv2/src/models"
	"fmt"

	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

func (db *DB) GetAllFacilities(page, itemsPerPage int) (int64, []models.Facility, error) {
	var total int64
	var facilities []models.Facility

	tx := db.Model(&models.Facility{})
	if err := tx.Count(&total).Error; err != nil {
		return total, nil, newGetRecordsDBError(err, "facilities")
	}
	if err := tx.Limit(itemsPerPage).Offset(calcOffset(page, itemsPerPage)).Find(&facilities).Error; err != nil {
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
	facility.ID = id
	if err := db.Save(&facility).Error; err != nil {
		log.WithField("facility_id", facility.ID).Error("error updating facility name database/UpdateFacility")
		return newUpdateDBError(err, "facilities")
	}
	return nil
}

func (db *DB) DeleteFacility(id int) error {
	updates := db.softDeleteMap()
	result := db.Model(&models.Facility{}).
		Where("id = ? AND deleted_at IS NULL", fmt.Sprintf("%d", id)).
		Updates(updates)
	if result.Error != nil {
		return newDeleteDBError(result.Error, "facilities")
	}
	if result.RowsAffected == 0 {
		return newDeleteDBError(gorm.ErrRecordNotFound, "facilities")
	}
	return nil
}
