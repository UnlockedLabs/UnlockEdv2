package database

import (
	"Go-Prototype/backend/cmd/models"
)

func (db *DB) GetAllUserActivity(page, perPage int) (int64, []models.UserActivity, error) {
	var userActivities []models.UserActivity
	var count int64
	if err := db.Conn.Model(&models.UserActivity{}).Count(&count).Error; err != nil {
		return 0, nil, err
	}
	if err := db.Conn.Offset((page - 1) * perPage).Limit(perPage).Find(&userActivities).Error; err != nil {
		return 0, nil, err
	}
	return count, userActivities, nil
}

func (db *DB) GetActivityForUser(userID int, page, perPage int) (int64, []models.UserActivity, error) {
	var userActivities []models.UserActivity
	var count int64
	if err := db.Conn.Model(&models.UserActivity{}).Where("user_id = ?", userID).Count(&count).Error; err != nil {
		return 0, nil, err
	}
	if err := db.Conn.Offset((page-1)*perPage).Limit(perPage).Where("user_id = ?", userID).Find(&userActivities).Error; err != nil {
		return 0, nil, err
	}
	return count, userActivities, nil
}

func (db *DB) CreateActivityForUser(activity *models.UserActivity) error {
	if err := db.Conn.Create(activity).Error; err != nil {
		return err
	}
	return nil
}
