package database

import (
	"Go-Prototype/backend/cmd/models"
)

func (db *DB) CreateActivity(activity *models.Activity) error {
	return db.Conn.Create(activity).Error
}

func (db *DB) GetActivityByUserID(page, perPage, userID int) (int64, []models.Activity, error) {
	var activities []models.Activity
	var count int64
	_ = db.Conn.Model(&models.Activity{}).Where("user_id = ?", userID).Count(&count)
	return count, activities, db.Conn.Where("user_id = ?", userID).Offset((page - 1) * perPage).Limit(perPage).Find(&activities).Error
}

func (db *DB) GetActivityByProgramID(page, perPage, programID int) (int64, []models.Activity, error) {
	var activities []models.Activity
	var count int64
	_ = db.Conn.Model(&models.Activity{}).Where("program_id = ?", programID).Count(&count)
	return count, activities, db.Conn.Where("program_id = ?", programID).Offset((page - 1) * perPage).Limit(perPage).Find(&activities).Error
}

func (db *DB) DeleteActivity(activityID int) error {
	return db.Conn.Delete(&models.Activity{}, activityID).Error
}
