package database

import (
	"UnlockEdv2/src/models"
)

func (db *DB) GetClassDashboardMetrics(ctx *models.QueryContext, facilityID *uint) (int64, int64, int64, int64, error) {
	var activeClasses int64
	var totalEnrollments int64
	var totalSeats int64
	var attendanceConcerns int64

	classQuery := db.WithContext(ctx.Ctx).
		Model(&models.ProgramClass{}).
		Where("status = ?", models.Active).
		Where("archived_at IS NULL")
	if facilityID != nil {
		classQuery = classQuery.Where("facility_id = ?", *facilityID)
	}

	if err := classQuery.Count(&activeClasses).Error; err != nil {
		return 0, 0, 0, 0, err
	}

	if err := classQuery.Select("COALESCE(SUM(capacity), 0)").Scan(&totalSeats).Error; err != nil {
		return 0, 0, 0, 0, err
	}

	enrollmentQuery := db.WithContext(ctx.Ctx).
		Table("program_class_enrollments e").
		Select("COUNT(*)").
		Joins("JOIN program_classes c ON c.id = e.class_id").
		Where("e.enrollment_status = ?", models.Enrolled).
		Where("c.status = ?", models.Active).
		Where("c.archived_at IS NULL")
	if facilityID != nil {
		enrollmentQuery = enrollmentQuery.Where("c.facility_id = ?", *facilityID)
	}
	if err := enrollmentQuery.Scan(&totalEnrollments).Error; err != nil {
		return 0, 0, 0, 0, err
	}

	attendanceSQL := `
SELECT COUNT(DISTINCT c.id)
FROM program_classes c
JOIN program_class_enrollments e ON e.class_id = c.id
WHERE c.status = ?
AND c.archived_at IS NULL
AND e.enrollment_status = ?
`
	args := []any{models.Active, models.Enrolled}
	if facilityID != nil {
		attendanceSQL += "AND c.facility_id = ?\n"
		args = append(args, *facilityID)
	}
	attendanceSQL += `
AND (
	select count(*)
	from program_class_events evt
	inner join program_class_event_attendance att on att.event_id = evt.id
	where evt.class_id = c.id
		and att.user_id = e.user_id
		and att.attendance_status = 'absent_unexcused'
) >= 3
`
	if err := db.WithContext(ctx.Ctx).Raw(attendanceSQL, args...).Scan(&attendanceConcerns).Error; err != nil {
		return 0, 0, 0, 0, err
	}

	return activeClasses, totalEnrollments, totalSeats, attendanceConcerns, nil
}
