package database

import (
	"UnlockEdv2/src/models"
	"errors"
	"fmt"

	log "github.com/sirupsen/logrus"
)

func (db *DB) GetAllFacilities() ([]models.Facility, error) {
	var facilities []models.Facility
	if err := db.Conn.Model(&models.Facility{}).Find(&facilities).Error; err != nil {
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

func (db *DB) CreateFacility(name *string) (*models.Facility, error) {
	log.Infoln("Creating facility:" + *name)
	if err := db.Conn.Create(models.Facility{Name: *name}).Error; err != nil {
		log.WithField("facility_name", *name).Error("error creating facility in database")
		return nil, err
	}
	newFacility := models.Facility{}
	if err := db.Conn.Model(models.Facility{}).Find(&newFacility, "name = ?", *name).Error; err != nil {
		return nil, err
	}
	return &newFacility, nil
}

func (db *DB) UpdateFacility(name *string, id uint) error {
	fields := log.Fields{"facility_id": id}
	log.WithFields(fields).Infof("Updating facility")
	if name == nil {
		log.WithFields(fields).Error("attempted to udpate immutable fields of facility")
		return errors.New("only the facility name can be updated")
	}
	if err := db.Conn.Model(models.Facility{}).Update("name", *name).Error; err != nil {
		log.WithFields(fields).Error("error updating facility name database/UpdateFacility")
		return err
	}
	return nil
}

func (db *DB) DeleteFacility(id int) error {
	log.Printf("Deleting facility with ID: %d", id)
	if err := db.Conn.Delete(&models.Facility{}, "id = ?", fmt.Sprintf("%d", id)).Error; err != nil {
		return err
	}
	return nil
}
