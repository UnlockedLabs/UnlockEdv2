package database

import (
	"Go-Prototype/backend/cmd/models"
)

func (db *DB) GetOutcomesForUser(id uint, page, perPage int) (int64, []models.Outcome, error) {
	var outcomes []models.Outcome
	var count int64
	offset := (page - 1) * perPage
	if err := db.Conn.Model(&models.Outcome{}).Where("user_id = ?", id).Count(&count).Error; err != nil {
		return 0, nil, err
	}
	if err := db.Conn.Where("user_id = ?", id).Offset(offset).Limit(perPage).Find(&outcomes).Error; err != nil {
		return 0, nil, err
	}
	return count, outcomes, nil
}

func (db *DB) CreateOutcome(outcome *models.Outcome) (*models.Outcome, error) {
	if err := db.Conn.Create(&outcome).Error; err != nil {
		return nil, err
	}
	return outcome, nil
}

func (db *DB) GetOutcomeByProgramID(id uint) (*models.Outcome, error) {
	var outcome models.Outcome
	if err := db.Conn.Where("program_id = ?", id).First(&outcome).Error; err != nil {
		return nil, err
	}
	return &outcome, nil
}

func (db *DB) UpdateOutcome(outcome *models.Outcome, id uint) (*models.Outcome, error) {
	toUpdate := models.Outcome{}
	if err := db.Conn.First(&toUpdate, id).Error; err != nil {
		return nil, err
	}
	models.UpdateStruct(&toUpdate, outcome)
	if err := db.Conn.Model(&models.Outcome{}).Where("id = ?", id).Updates(&toUpdate).Error; err != nil {
		return nil, err
	}
	return &toUpdate, nil
}

func (db *DB) DeleteOutcome(id uint) error {
	if err := db.Conn.Delete(&models.Outcome{}, id).Error; err != nil {
		return err
	}
	return nil
}
