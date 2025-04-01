package database

import (
	"UnlockEdv2/src/models"
	"net/url"
	"time"
)

func (db *DB) GetAttendees(page, perPage int, params url.Values, classId int) ([]models.ProgramClassEventAttendance, error) {
	date := params.Get("date")
	userId := params.Get("user_id")
	eventId := params.Get("event_id")
	tx := db.Model(&models.ProgramClassEventAttendance{})
	if date != "" {
		tx = tx.Where("date = ?", date)
	}
	if userId != "" {
		tx = tx.Where("user_id = ?", userId)
	}
	if eventId != "" {
		tx = tx.Where("event_id = ?", eventId)
	}
	attendance := make([]models.ProgramClassEventAttendance, 0)
	total := int64(0)
	err := tx.Count(&total).Limit(perPage).Offset(calcOffset(page, perPage)).Find(&attendance).Error
	if err != nil {
		return nil, newGetRecordsDBError(err, "class_event_attendance")
	}
	return attendance, nil
}

func (db *DB) LogUserAttendance(eventId, userId int, date string) (*models.ProgramClassEventAttendance, error) {
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}
	attendance := models.ProgramClassEventAttendance{
		EventID: uint(eventId),
		UserID:  uint(userId),
		Date:    date,
	}
	if err := db.Create(&attendance).Error; err != nil {
		return nil, newCreateDBError(err, "class_event_attendance")
	}
	return &attendance, nil
}

func (db *DB) DeleteAttendance(eventId, userId int, date string) error {
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}
	err := db.Where("event_id = ? AND user_id = ? AND date = ?", eventId, userId, date).Delete(&models.ProgramClassEventAttendance{}).Error
	if err != nil {
		return newDeleteDBError(err, "class_event_attendance")
	}
	return nil
}
