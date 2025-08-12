package database

import (
	"UnlockEdv2/src/models"
	"context"
	"fmt"
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
	attendance := make([]models.ProgramClassEventAttendance, 0, queryParams.PerPage)
	if err := tx.Count(&queryParams.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "class_event_attendance")
	}
	err := tx.Order(queryParams.OrderClause("program_class_event_attendance.created_at DESC")).Limit(queryParams.PerPage).Offset(queryParams.CalcOffset()).Find(&attendance).Error
	if err != nil {
		return nil, newGetRecordsDBError(err, "class_event_attendance")
	}
	return attendance, nil
}

func (db *DB) LogUserAttendance(attendanceParams []models.ProgramClassEventAttendance) error {
	tx := db.Begin()
	if tx.Error != nil {
		return NewDBError(tx.Error, "unable to start DB transaction")
	}

	for _, att := range attendanceParams {
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

func (db *DB) GetEnrollmentsWithAttendanceForEvent(qryCtx *models.QueryContext, classID, eventID int, date string, includeCurrentlyEnrolled bool) ([]models.EnrollmentAttendance, error) {
	baseQuery := `
        FROM program_class_enrollments AS e
        JOIN users AS u ON u.id = e.user_id
        LEFT JOIN program_class_event_attendance AS a
            ON a.user_id = e.user_id AND a.event_id = ? AND a.date = ?
        WHERE e.class_id = ?
        `

	if includeCurrentlyEnrolled {
		baseQuery += `
           AND (
                (DATE(e.enrolled_at) <= ?::date AND (e.enrollment_ended_at IS NULL OR DATE(e.enrollment_ended_at) >= ?::date))
                OR e.enrollment_status = 'Enrolled'
           )
        `
	} else {
		baseQuery += `
           AND DATE(e.enrolled_at) <= ?::date
           AND (e.enrollment_ended_at IS NULL OR DATE(e.enrollment_ended_at) >= ?::date)
        `
	}

	args := []any{eventID, date, classID, date, date}

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
		finalQuery += " ORDER BY " + adjustUserOrderBy(qryCtx.OrderClause("e.created_at DESC"))
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

func (db *DB) GetAttendanceRateForEvent(ctx context.Context, eventID int, classID int) (float64, error) {
	var attendanceRate float64
	sql := `select coalesce(count(*) filter (where attendance_status = 'present') * 100.0 /
		nullif(count(*) filter (where attendance_status is not null and attendance_status != ''), 0), 0) as attendance_percentage
		from program_class_event_attendance pcea
		inner join program_class_events pce on pce.id = pcea.event_id
		where pcea.event_id = ?
			and pce.id = ?`
	if err := db.WithContext(ctx).Raw(sql, eventID, classID).Scan(&attendanceRate).Error; err != nil {
		return 0, newNotFoundDBError(err, "program_class_event_attendance")
	}
	return attendanceRate, nil
}

func (db *DB) GetAttendanceFlagsForClass(classID int, args *models.QueryContext) ([]models.AttendanceFlag, error) {
	flags := make([]models.AttendanceFlag, 0, args.PerPage)
	attendanceCoreSQL := `from program_class_enrollments e
		inner join program_classes c on c.id = e.class_id
		inner join users u on u.id = e.user_id
		where c.id = ?
		and e.enrollment_status = 'Enrolled'
		and c.status = 'Active'
		and exists (select 1 from program_class_events evt
				inner join program_class_event_attendance att on att.event_id = evt.id
				where evt.class_id = c.id
						and att.attendance_status is not null
		)`
	noAttendanceSQL := `and not exists (select 1 from program_class_events evt
			inner join program_class_event_attendance att on att.event_id = evt.id
			where evt.class_id = c.id
					and att.user_id = e.user_id
					and att.attendance_status = 'present'
		)`
	multiAbsencesSQL := `and exists (select 1 from program_class_events evt
			inner join program_class_event_attendance att on att.event_id = evt.id
			where evt.class_id = c.id
					and att.user_id = e.user_id
					and att.attendance_status = 'present'
		)
		and (select count(*) from program_class_events evt
				inner join program_class_event_attendance att on att.event_id = evt.id
				where evt.class_id = c.id
						and att.user_id = e.user_id
						and att.attendance_status = 'absent_unexcused'
		) >= 3`
	//count for pagination
	countQuery := fmt.Sprintf(`select count(*) from (
			select u.id %s %s
			union all
			select u.id %s %s
		) as attendance_flags`, attendanceCoreSQL, noAttendanceSQL, attendanceCoreSQL, multiAbsencesSQL)

	if err := db.WithContext(args.Ctx).Raw(countQuery, classID, classID).Scan(&args.Total).Error; err != nil {
		return nil, newNotFoundDBError(err, "program_class_event_attendance")
	}

	attendanceQuery := fmt.Sprintf(`select name_first, name_last, doc_id, flag_type from (
			select u.name_first, u.name_last, 
			u.doc_id, 'no_attendance' as flag_type %s %s
			union all
			select u.name_first, u.name_last, 
			u.doc_id, 'multiple_absences' as flag_type %s %s
		) AS attendance_flags
		ORDER BY name_last, name_first
		LIMIT ? OFFSET ?`, attendanceCoreSQL, noAttendanceSQL, attendanceCoreSQL, multiAbsencesSQL)
	if err := db.WithContext(args.Ctx).Raw(attendanceQuery, classID, classID, args.PerPage, args.CalcOffset()).Scan(&flags).Error; err != nil {
		return nil, newNotFoundDBError(err, "program_class_event_attendance")
	}

	return flags, nil
}
