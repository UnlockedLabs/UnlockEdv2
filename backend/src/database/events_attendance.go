package database

import (
	"UnlockEdv2/src/models"
	"net/url"
	"time"

	"gorm.io/gorm/clause"
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

func (db *DB) LogUserAttendance(attendance_params *models.ProgramClassEventAttendance) (*models.ProgramClassEventAttendance, error) {
	if attendance_params.Date == "" {
		attendance_params.Date = time.Now().Format("2006-01-02")
	}
	err := db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "event_id"}, {Name: "user_id"}, {Name: "date"}},
		DoUpdates: clause.AssignmentColumns([]string{"attendance_status", "note"}),
	}).Create(&attendance_params).Error
	if err != nil {
		return nil, newCreateDBError(err, "class_event_attendance")
	}
	return attendance_params, nil
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

func (db *DB) GetEnrollmentsWithAttendanceForEvent(qryCtx *models.QueryContext, classID, eventID int, date string) ([]models.EnrollmentAttendance, error) {
	var enrollments []models.ProgramClassEnrollment
	tx := db.WithContext(qryCtx.Ctx).Preload("User").Where("class_id = ?", classID)

	if err := tx.Model(&models.ProgramClassEnrollment{}).Count(&qryCtx.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_enrollments")
	}

	if err := tx.
		Offset(qryCtx.CalcOffset()).
		Limit(qryCtx.PerPage).
		Find(&enrollments).
		Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_enrollments")
	}

	var attendanceRecords []models.ProgramClassEventAttendance
	if err := db.WithContext(qryCtx.Ctx).
		Where("event_id = ? AND date = ?", eventID, date).
		Find(&attendanceRecords).
		Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_event_attendance")
	}

	attendanceMap := make(map[uint]models.ProgramClassEventAttendance)
	for _, att := range attendanceRecords {
		attendanceMap[att.UserID] = att
	}

	var combined []models.EnrollmentAttendance
	for _, enrollment := range enrollments {
		ea := models.EnrollmentAttendance{
			Enrollment: enrollment,
		}
		if att, ok := attendanceMap[enrollment.UserID]; ok {
			ea.Attendance = &att
		}
		combined = append(combined, ea)
	}
	return combined, nil
}
