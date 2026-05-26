package database

import (
	"UnlockEdv2/src/models"
)

func (db *DB) GetClassDashboardMetrics(ctx *models.QueryContext, facilityID *uint) (models.ClassDashboardMetrics, error) {
	var metrics models.ClassDashboardMetrics

	var err error
	if metrics.ActiveClasses, err = db.GetActiveClassCount(ctx, facilityID); err != nil {
		return metrics, err
	}
	if metrics.TotalSeats, err = db.GetTotalSeatCount(ctx, facilityID); err != nil {
		return metrics, err
	}
	if metrics.ScheduledClasses, err = db.GetScheduledClassCount(ctx, facilityID); err != nil {
		return metrics, err
	}
	if metrics.TotalEnrollments, err = db.GetTotalEnrollmentsCount(ctx, facilityID); err != nil {
		return metrics, err
	}
	if metrics.AttendanceConcerns, err = db.GetAttendanceConcernsCount(ctx, facilityID); err != nil {
		return metrics, err
	}

	return metrics, nil
}

func (db *DB) GetActiveClassCount(ctx *models.QueryContext, facilityID *uint) (int64, error) {
	var count int64
	query := db.WithContext(ctx.Ctx).
		Model(&models.ProgramClass{}).
		Where("status = ?", models.Active).
		Where("archived_at IS NULL")
	if facilityID != nil {
		query = query.Where("facility_id = ?", *facilityID)
	}
	if err := query.Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func (db *DB) GetTotalSeatCount(ctx *models.QueryContext, facilityID *uint) (int64, error) {
	var totalSeats int64
	query := db.WithContext(ctx.Ctx).
		Model(&models.ProgramClass{}).
		Where("status = ?", models.Active).
		Where("archived_at IS NULL")
	if facilityID != nil {
		query = query.Where("facility_id = ?", *facilityID)
	}
	if err := query.Select("COALESCE(SUM(capacity), 0)").Scan(&totalSeats).Error; err != nil {
		return 0, err
	}
	return totalSeats, nil
}

func (db *DB) GetScheduledClassCount(ctx *models.QueryContext, facilityID *uint) (int64, error) {
	var count int64
	query := db.WithContext(ctx.Ctx).
		Model(&models.ProgramClass{}).
		Where("status = ?", models.Scheduled).
		Where("archived_at IS NULL")
	if facilityID != nil {
		query = query.Where("facility_id = ?", *facilityID)
	}
	if err := query.Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func (db *DB) GetTotalEnrollmentsCount(ctx *models.QueryContext, facilityID *uint) (int64, error) {
	var count int64
	query := db.WithContext(ctx.Ctx).
		Table("program_class_enrollments e").
		Select("COUNT(*)").
		Joins("JOIN program_classes c ON c.id = e.class_id").
		Where("e.enrollment_status = ?", models.Enrolled).
		Where("c.status = ?", models.Active).
		Where("c.archived_at IS NULL")
	if facilityID != nil {
		query = query.Where("c.facility_id = ?", *facilityID)
	}
	if err := query.Scan(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func (db *DB) GetAttendanceConcernsCount(ctx *models.QueryContext, facilityID *uint) (int64, error) {
	attendanceSQL := `SELECT COUNT(DISTINCT c.id)
		FROM program_classes c
		JOIN program_class_enrollments e ON e.class_id = c.id
		WHERE c.status = ?
			AND c.archived_at IS NULL
			AND e.enrollment_status = ? `
	args := []any{models.Active, models.Enrolled}
	if facilityID != nil {
		attendanceSQL += "AND c.facility_id = ? "
		args = append(args, *facilityID)
	}
	attendanceSQL += ` AND (
	select count(*)
	from program_class_events evt
	inner join program_class_event_attendance att on att.event_id = evt.id
	where evt.class_id = c.id
		and att.user_id = e.user_id
		and att.attendance_status = 'absent_unexcused'
	) >= 3 `
	var count int64
	if err := db.WithContext(ctx.Ctx).Raw(attendanceSQL, args...).Scan(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

type facilityCount struct {
	FacilityID uint  `gorm:"column:facility_id"`
	Count      int64 `gorm:"column:count"`
}

func (db *DB) GetFacilityHealthSummaries(ctx *models.QueryContext, facilityID *uint) ([]models.FacilityHealthSummary, error) {
	var summaries []models.FacilityHealthSummary
	query := `SELECT
			f.id as facility_id,
			f.name as facility_name,
			COALESCE(COUNT(DISTINCT p.id), 0) as programs,
			COALESCE(COUNT(DISTINCT pc.id), 0) as active_classes,
			COALESCE(COUNT(DISTINCT pce.id), 0) as enrollment
		FROM facilities f
		LEFT JOIN facilities_programs fp
			ON fp.facility_id = f.id
			AND fp.deleted_at IS NULL
		LEFT JOIN programs p
			ON p.id = fp.program_id
			AND p.is_active = true
			AND p.deleted_at IS NULL
			AND p.archived_at IS NULL
		LEFT JOIN program_classes pc
			ON pc.facility_id = f.id
			AND pc.status = ?
			AND pc.archived_at IS NULL
		LEFT JOIN program_class_enrollments pce
			ON pce.class_id = pc.id
			AND pce.enrollment_status = ?
		WHERE f.deleted_at IS NULL `
	args := []any{models.Active, models.Enrolled}
	if facilityID != nil {
		query += " AND f.id = ? "
		args = append(args, *facilityID)
	}
	query += "GROUP BY f.id, f.name ORDER BY f.name"

	if err := db.WithContext(ctx.Ctx).Raw(query, args...).Scan(&summaries).Error; err != nil {
		return nil, err
	}
	return summaries, nil
}

func (db *DB) GetFacilityAttendanceConcerns(ctx *models.QueryContext, facilityID *uint) (map[uint]int64, error) {
	attendanceSQL := `SELECT c.facility_id as facility_id, COUNT(DISTINCT c.id) as count
		FROM program_classes c
		JOIN program_class_enrollments e ON e.class_id = c.id
		WHERE c.status = ?
		AND c.archived_at IS NULL
		AND e.enrollment_status = ? `
	args := []any{models.Active, models.Enrolled}
	if facilityID != nil {
		attendanceSQL += "AND c.facility_id = ? "
		args = append(args, *facilityID)
	}
	attendanceSQL += ` AND (
	select count(*)
	from program_class_events evt
	inner join program_class_event_attendance att on att.event_id = evt.id
	where evt.class_id = c.id
		and att.user_id = e.user_id
		and att.attendance_status = 'absent_unexcused'
	) >= 3
	GROUP BY c.facility_id`

	var counts []facilityCount
	if err := db.WithContext(ctx.Ctx).Raw(attendanceSQL, args...).Scan(&counts).Error; err != nil {
		return nil, err
	}

	results := make(map[uint]int64, len(counts))
	for _, entry := range counts {
		results[entry.FacilityID] = entry.Count
	}
	return results, nil
}
