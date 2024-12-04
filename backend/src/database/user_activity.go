package database

import (
	"UnlockEdv2/src/models"
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

func (db *DB) GetAllUserActivity(order string, page, perPage int) (int64, []UserAcitivityJoin, error) {
	var count int64
	if err := db.Model(&models.UserActivity{}).Count(&count).Error; err != nil {
		return 0, nil, err
	}
	if order == "" {
		order = "user_activities.created_at desc"
	}
	var userActivities []UserAcitivityJoin
	if err := db.
		Table("user_activities").
		Select("user_activities.id, user_activities.user_id, user_activities.browser_name, user_activities.clicked_url, user_activities.created_at, user_activities.device, user_activities.platform, user_activities.updated_at, users.name_first as user_name_first, users.name_last as user_name_last").
		Joins("JOIN users ON user_activities.user_id = users.id").
		Order(order).
		Offset(calcOffset(page, perPage)).
		Limit(perPage).
		Find(&userActivities).
		Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "user_activities")
	}
	return count, userActivities, nil
}

func (db *DB) SearchUserActivity(search string, order string, page, perPage int) (int64, []UserAcitivityJoin, error) {
	var count int64
	if err := db.Model(&models.UserActivity{}).
		Joins("JOIN users ON user_activities.user_id = users.id").
		Where("clicked_url LIKE ?", "%"+search+"%").
		Or("LOWER(users.name_last) LIKE ?", "%"+search+"%").
		Or("LOWER(users.name_first) LIKE ?", "%"+search+"%").
		Count(&count).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "user_activities")
	}
	if order == "" {
		order = "user_activities.created_at desc"
	}
	var userActivities []UserAcitivityJoin
	if err := db.
		Table("user_activities").
		Select("user_activities.id, user_activities.user_id, user_activities.browser_name, user_activities.clicked_url, user_activities.created_at, user_activities.device, user_activities.platform, user_activities.updated_at, users.name_first as user_name_first, users.name_last as user_name_last").
		Joins("JOIN users ON user_activities.user_id = users.id").
		Where("clicked_url LIKE ?", "%"+search+"%").
		Or("LOWER(users.name_last) LIKE ?", "%"+search+"%").
		Or("LOWER(users.name_first) LIKE ?", "%"+search+"%").
		Order(order).
		Offset(calcOffset(page, perPage)).
		Limit(perPage).
		Find(&userActivities).
		Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "user_activities")
	}
	return count, userActivities, nil
}

func (db *DB) GetActivityForUser(userID int, page, perPage int) (int64, []models.UserActivity, error) {
	var userActivities []models.UserActivity
	var count int64
	if err := db.Model(&models.UserActivity{}).Where("user_id = ?", userID).Count(&count).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "user_activities")
	}
	if err := db.Offset(calcOffset(page, perPage)).Limit(perPage).Where("user_id = ?", userID).Find(&userActivities).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "user_activities")
	}
	return count, userActivities, nil
}

func (db *DB) CreateActivityForUser(activity *models.UserActivity) error {
	if err := db.Create(activity).Error; err != nil {
		return newCreateDBError(err, "user_activities")
	}
	return nil
}
