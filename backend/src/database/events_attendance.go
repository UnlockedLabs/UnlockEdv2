package database

import (
	"UnlockEdv2/src/models"
	"net/url"
	"slices"
	"time"

	"gorm.io/gorm/clause"
)

func (db *DB) GetAttendees(queryParams *models.QueryContext, params url.Values, classId int) ([]models.ProgramClassEventAttendance, error) {
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
	err := tx.Count(&queryParams.Total).Limit(queryParams.PerPage).Offset(queryParams.CalcOffset()).Find(&attendance).Error
	if err != nil {
		return nil, newGetRecordsDBError(err, "class_event_attendance")
	}
	return attendance, nil
}

func (db *DB) LogUserAttendance(attendanceParams *[]models.ProgramClassEventAttendance) error {
	tx := db.Begin()
	if tx.Error != nil {
		return NewDBError(tx.Error, "unable to start DB transaction")
	}

	for _, att := range *attendanceParams {
		if err := tx.
			Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "event_id"}, {Name: "user_id"}, {Name: "date"}},
				DoUpdates: clause.AssignmentColumns([]string{"attendance_status", "note"}),
			}).
			Create(&att).Error; err != nil {
			tx.Rollback()
			return newCreateDBError(err, "upserting attendance record")
		}
	}

	if err := tx.Commit().Error; err != nil {
		return NewDBError(err, "unable to commit DB transaction")
	}
	return nil
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
	baseQuery := `
		FROM program_class_enrollments AS e
		JOIN users AS u ON u.id = e.user_id
		LEFT JOIN program_class_event_attendance AS a
			ON a.user_id = e.user_id AND a.event_id = ? AND a.date = ?
		WHERE e.class_id = ?`

	args := []any{eventID, date, classID}

	if qryCtx.Search != "" {
		query := qryCtx.SearchQuery()
		baseQuery += ` AND (LOWER(u.name_first) LIKE ? OR LOWER(u.name_last) LIKE ? OR LOWER(u.doc_id) LIKE ?)`
		args = append(args, query, query, query)
	}

	countQuery := "SELECT COUNT(*) " + baseQuery
	if err := db.WithContext(qryCtx.Ctx).Raw(countQuery, args...).Scan(&qryCtx.Total).Error; err != nil {
		return nil, err
	}
	selectClause := `
		SELECT
			e.id AS enrollment_id,
			e.class_id AS class_id,
			e.enrollment_status AS enrollment_status,
			u.id AS user_id,
			u.username AS username,
			u.name_first AS name_first,
			u.name_last AS name_last,
            u.doc_id AS doc_id,
			a.id AS attendance_id,
			a.event_id AS event_id,
			a.date AS date,
			a.attendance_status AS attendance_status,
			a.note AS note`
	finalQuery := selectClause + baseQuery

	if slices.Contains([]string{"name_first", "name_last"}, qryCtx.OrderBy) {
		finalQuery += " ORDER BY " + qryCtx.OrderClause()
	} else {
		finalQuery += " ORDER BY e.id ASC"
	}

	finalQuery += " LIMIT ? OFFSET ?"
	args = append(args, qryCtx.PerPage, qryCtx.CalcOffset())

	var results []models.EnrollmentAttendance
	if err := db.WithContext(qryCtx.Ctx).Raw(finalQuery, args...).Scan(&results).Error; err != nil {
		return nil, err
	}

	return results, nil
}
