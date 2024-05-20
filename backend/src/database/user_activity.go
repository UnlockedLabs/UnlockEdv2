package database

import (
	"Go-Prototype/src/models"
)

type UserAcitivityJoin struct {
	ID            int    `json:"id"`
	UserNameFirst string `json:"user_name_first"`
	UserNameLast  string `json:"user_name_last"`
	BrowserName   string `json:"browser_name"`
	ClickedUrl    string `json:"clicked_url"`
	CreatedAt     string `json:"created_at"`
	Device        string `json:"device"`
	Platform      string `json:"platform"`
	UpdatedAt     string `json:"updated_at"`
}

func (db *DB) GetAllUserActivity(page, perPage int) (int64, []UserAcitivityJoin, error) {
	var count int64
	if err := db.Conn.Model(&models.UserActivity{}).Count(&count).Error; err != nil {
		return 0, nil, err
	}
	var userActivities []UserAcitivityJoin
	if err := db.Conn.
		Table("user_activities").
		Select("user_activities.id, user_activities.user_id, user_activities.browser_name, user_activities.clicked_url, user_activities.created_at, user_activities.device, user_activities.platform, user_activities.updated_at, users.name_first as user_name_first, users.name_last as user_name_last").
		Joins("JOIN users ON user_activities.user_id = users.id").
		Order("user_activities.created_at DESC").
		Offset((page - 1) * perPage).
		Limit(perPage).
		Find(&userActivities).
		Error; err != nil {
		return 0, nil, err
	}
	return count, userActivities, nil
}

func (db *DB) SearchUserActivity(search string, page, perPage int) (int64, []UserAcitivityJoin, error) {
	var count int64
	if err := db.Conn.Model(&models.UserActivity{}).Where("clicked_url LIKE ?", "%"+search+"%").Count(&count).Error; err != nil {
		return 0, nil, err
	}
	var userActivities []UserAcitivityJoin
	if err := db.Conn.
		Table("user_activities").
		Select("user_activities.id, user_activities.user_id, user_activities.browser_name, user_activities.clicked_url, user_activities.created_at, user_activities.device, user_activities.platform, user_activities.updated_at, users.name_first as user_name_first, users.name_last as user_name_last").
		Joins("JOIN users ON user_activities.user_id = users.id").
		Where("clicked_url LIKE ?", "%"+search+"%").
		Or("users.name_last LIKE ?", "%"+search+"%").
		Or("users.name_first LIKE ?", "%"+search+"%").
		Order("user_activities.created_at DESC").
		Offset((page - 1) * perPage).
		Limit(perPage).
		Find(&userActivities).
		Error; err != nil {
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
