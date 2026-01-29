package database

import (
	"UnlockEdv2/src/models"
	"context"
	"fmt"
	"net/url"
	"slices"
	"time"

	"gorm.io/gorm"
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

func (db *DB) LogUserAttendance(attendanceParams []models.ProgramClassEventAttendance, ctx context.Context, adminID *uint, className string) error {
	var updateUserID uint
	if ctx := db.Statement.Context; ctx != nil {
		if userID, ok := ctx.Value(models.UserIDKey).(uint); ok {
			updateUserID = userID
		}
	}
	tx := db.Begin()
	if tx.Error != nil {
		return NewDBError(tx.Error, "unable to start DB transaction")
	}

	for _, att := range attendanceParams {
		existingRow := updateUserID != 0 && att.ID != 0
		if existingRow {
			att.UpdateUserID = &updateUserID
		}

		if err := tx.
			Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "event_id"}, {Name: "user_id"}, {Name: "date"}},
				DoUpdates: clause.AssignmentColumns([]string{"attendance_status", "note", "reason_category", "check_in_at", "check_out_at", "minutes_attended", "scheduled_minutes", "update_user_id"}),
			}).
			Create(&att).Error; err != nil {
			tx.Rollback()
			return newCreateDBError(err, "upserting attendance record")
		}

		sessionDateParsed, err := time.ParseInLocation("2006-01-02", att.Date, time.Local)
		if err != nil {
			tx.Rollback()
			return NewDBError(err, "invalid session date format")
		}

		history := models.NewUserAccountHistory(att.UserID, models.AttendanceRecorded, adminID, nil, nil)
		history.AttendanceStatus = att.AttendanceStatus
		history.ClassName = &className
		history.SessionDate = &sessionDateParsed

		if err := tx.Create(history).Error; err != nil {
			tx.Rollback()
			return newCreateDBError(err, "user_account_history")
		}
	}

	if err := tx.Commit().Error; err != nil {
		return NewDBError(err, "unable to commit DB transaction")
	}
	return nil
}

func (db *DB) DeleteAttendance(eventId, userId int, date string, ctx context.Context, adminID *uint, className string) (int64, error) {
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	tx := db.Begin().WithContext(ctx)
	if tx.Error != nil {
		return 0, NewDBError(tx.Error, "unable to start DB transaction")
	}

	result := tx.Where("event_id = ? AND user_id = ? AND date = ?", eventId, userId, date).Delete(&models.ProgramClassEventAttendance{})
	if result.Error != nil {
		tx.Rollback()
		return 0, newDeleteDBError(result.Error, "class_event_attendance")
	}

	if result.RowsAffected > 0 {
		sessionDateParsed, err := time.ParseInLocation("2006-01-02", date, time.Local)
		if err != nil {
			tx.Rollback()
			return 0, NewDBError(err, "invalid session date format")
		}

		history := models.NewUserAccountHistory(uint(userId), models.AttendanceRecorded, adminID, nil, nil)
		history.AttendanceStatus = models.Attendance("deleted")
		history.ClassName = &className
		history.SessionDate = &sessionDateParsed

		if err := tx.Create(history).Error; err != nil {
			tx.Rollback()
			return 0, newCreateDBError(err, "user_account_history")
		}
	}

	if err := tx.Commit().Error; err != nil {
		return 0, NewDBError(err, "unable to commit DB transaction")
	}

	return result.RowsAffected, nil
}

func (db *DB) GetEnrolledUserIDsForClass(classID uint, userIDs []uint) ([]uint, error) {
	var enrolledIDs []uint
	tx := db.Model(&models.ProgramClassEnrollment{}).
		Where("class_id = ? AND enrollment_status = ?", classID, models.Enrolled)
	if len(userIDs) > 0 {
		tx = tx.Where("user_id IN ?", userIDs)
	}
	if err := tx.Pluck("user_id", &enrolledIDs).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_enrollments")
	}
	return enrolledIDs, nil
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
			a.note AS note,
			a.reason_category AS reason_category,
			a.check_in_at AS check_in_at,
			a.check_out_at AS check_out_at,
			a.minutes_attended AS minutes_attended,
			a.scheduled_minutes AS scheduled_minutes`
	finalQuery := selectClause + baseQuery
	if slices.Contains([]string{"name_first", "name_last"}, qryCtx.OrderBy) {
		finalQuery += " ORDER BY " + adjustUserOrderBy(qryCtx.OrderClause("e.created_at DESC"))
	} else {
		finalQuery += " ORDER BY e.id ASC"
	}

	finalQuery += " LIMIT ? OFFSET ?"
	args = append(args, qryCtx.PerPage, qryCtx.CalcOffset())
	var results []models.EnrollmentAttendance

	newSession := db.Session(&gorm.Session{NewDB: true})
	if err := newSession.WithContext(qryCtx.Ctx).Raw(finalQuery, args...).Scan(&results).Error; err != nil {
		return nil, err
	}
	return results, nil
}

func (db *DB) GetAttendanceRateForEvent(ctx context.Context, eventID int, classID int, eventDate string) (float64, error) {
	var attendanceRate float64
	sql := `
	select coalesce(
		sum(
			case
				when pcea.attendance_status = 'present' then 1
				when pcea.attendance_status = 'partial' then least(
					coalesce(pcea.minutes_attended, pcea.scheduled_minutes, 0)::numeric /
					nullif(coalesce(pcea.scheduled_minutes, pcea.minutes_attended, 0), 0),
					1
				)
				else 0
			end
		) * 100.0 /
		nullif(
			(select count(*) from program_class_enrollments e
			 where e.class_id = ?
			   and e.enrolled_at <= ?
			   and (e.enrollment_ended_at IS NULL OR e.enrollment_ended_at >= ?)),
			0
		), 0
	) as attendance_percentage
	from program_class_event_attendance pcea
	inner join program_class_events pce ON pce.id = pcea.event_id
	where pcea.event_id = ? AND pcea.date = ?`

	if err := db.WithContext(ctx).Raw(sql, classID, eventDate, eventDate, eventID, eventDate).Scan(&attendanceRate).Error; err != nil {
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
					and att.attendance_status in ('present','partial')
		)`
	multiAbsencesSQL := `and exists (select 1 from program_class_events evt
			inner join program_class_event_attendance att on att.event_id = evt.id
			where evt.class_id = c.id
					and att.user_id = e.user_id
					and att.attendance_status in ('present','partial')
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

func (db *DB) GetMissingAttendance(classID int, args *models.QueryContext) (int, error) {
	var events []models.ProgramClassEvent
	err := db.WithContext(args.Ctx).
		Preload("Class").
		Where("class_id = ?", classID).
		Find(&events).Error
	if err != nil {
		return 0, newNotFoundDBError(err, "program_class_events")
	}
	allEventDates := make([]models.EventInstance, 0, 20)
	if len(events) == 1 {
		allEventDates = generateEventInstances(events[0], events[0].Class.StartDt, time.Now().AddDate(0, 0, 1)) // adds one day to today so today is included
	} else {
		for _, event := range events {
			startDate := event.Class.StartDt
			endDate := time.Now().AddDate(0, 0, 1)                                // adds one day to today so today is included
			if event.Class.EndDt != nil && event.Class.EndDt.Before(time.Now()) { //if it has an end date that is before today, then use that
				endDate = *event.Class.EndDt
			}
			eventInstances := generateEventInstances(event, startDate, endDate)
			allEventDates = append(allEventDates, eventInstances...)
		}
	}
	totalEvents := len(allEventDates)

	var students []models.ProgramClassEnrollment
	err = db.WithContext(args.Ctx).
		Where("class_id = ?", classID).
		Find(&students).Error
	if err != nil {
		return 0, newGetRecordsDBError(err, "program_class_enrollments")
	}

	type AttendanceDateCount struct {
		EventID int    `json:"event_id"`
		Date    string `json:"date"`
		Count   int64  `json:"count"`
	}

	var attendanceCounts []AttendanceDateCount
	eventIDs := make([]uint, len(allEventDates))
	dates := make([]string, len(allEventDates))

	for i, eventDate := range allEventDates {
		eventIDs[i] = eventDate.EventID
		dates[i] = eventDate.StartTime.Format("2006-01-02")
	}

	err = db.WithContext(args.Ctx).
		Model(&models.ProgramClassEventAttendance{}).
		Select("event_id, date, COUNT(*) as count").
		Where("event_id IN ? AND date IN ?", eventIDs, dates).
		Group("event_id, date").
		Scan(&attendanceCounts).Error
	if err != nil {
		return 0, newGetRecordsDBError(err, "program_class_event_attendance")
	}

	attendanceMap := make(map[string]int64)
	for _, attendance := range attendanceCounts {
		key := fmt.Sprintf("%d_%s", attendance.EventID, attendance.Date)
		attendanceMap[key] = attendance.Count
	}

	completedAttendanceDates := 0
	for _, eventDate := range allEventDates {
		// count enrolled students on this specific date
		enrolledCountOnDate := 0
		for _, student := range students {
			if !student.EnrolledAt.After(eventDate.StartTime) && // enrolled before or on this date
				(student.EnrollmentEndedAt == nil || student.EnrollmentEndedAt.After(eventDate.StartTime.AddDate(0, 0, -1))) { // not ended before this date
				enrolledCountOnDate++
			}
		}

		key := fmt.Sprintf("%d_%s", eventDate.EventID, eventDate.StartTime.Format("2006-01-02"))
		attendanceCount, exists := attendanceMap[key]
		if !exists {
			attendanceCount = 0
		}

		if int(attendanceCount) == enrolledCountOnDate {
			completedAttendanceDates++
		}
	}
	missingAttendanceCount := totalEvents - completedAttendanceDates
	return missingAttendanceCount, nil
}

func (db *DB) CreateAttendanceAuditTrail(ctx context.Context, att *models.ProgramClassEventAttendance, adminID *uint, className string) error {

	sessionDateParsed, err := time.ParseInLocation("2006-01-02", att.Date, time.Local)
	if err != nil {
		return NewDBError(err, "invalid session date format")
	}

	history := models.NewUserAccountHistory(att.UserID, models.AttendanceRecorded, adminID, nil, nil)
	history.AttendanceStatus = att.AttendanceStatus
	history.ClassName = &className
	history.SessionDate = &sessionDateParsed

	if err := db.WithContext(ctx).Create(history).Error; err != nil {
		return newCreateDBError(err, "user_account_history")
	}

	return nil
}

func (db *DB) GetCumulativeAttendanceRateForClass(ctx context.Context, classID int) (float64, error) {
	var attendanceRate float64
	today := time.Now().Format("2006-01-02")
	sql := `
	WITH attendance_credits AS (
		SELECT
			pcea.id,
			CASE
				WHEN pcea.attendance_status = 'present' THEN 1.0
				WHEN pcea.attendance_status = 'partial' THEN LEAST(
					COALESCE(pcea.minutes_attended, pcea.scheduled_minutes, 0)::numeric /
					NULLIF(COALESCE(pcea.scheduled_minutes, pcea.minutes_attended, 0), 0),
					1
				)
				ELSE 0
			END as credit
		FROM program_class_event_attendance pcea
		INNER JOIN program_class_events pce ON pce.id = pcea.event_id
		WHERE pce.class_id = ? AND pcea.date <= ?
	)
	SELECT COALESCE(
		(SELECT SUM(credit) FROM attendance_credits) * 100.0 /
		NULLIF((SELECT COUNT(*) FROM attendance_credits), 0),
		0
	) as attendance_percentage`

	if err := db.WithContext(ctx).Raw(sql, classID, today).Scan(&attendanceRate).Error; err != nil {
		return 0, newNotFoundDBError(err, "program_class_event_attendance")
	}
	return attendanceRate, nil
}
