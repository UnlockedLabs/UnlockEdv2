package database

import (
	"UnlockEdv2/src/models"
	"context"
	"fmt"
	"math"
	"strings"
)

var rosterStatusFilterMap = map[string]string{
	"Enrolled":           "Enrolled",
	"Completed":          "Completed",
	"Cancelled":          "Cancelled",
	"Withdrawn":          "Incomplete: Withdrawn",
	"Dropped":            "Incomplete: Dropped",
	"Segregated":         "Incomplete: Segregated",
	"Failed to Complete": "Incomplete: Failed to Complete",
	"Transfered":         "Incomplete: Transfered",
}

const sessionsAttendedSubquery = `(SELECT COUNT(*) FROM program_class_event_attendance pcea
		JOIN program_class_events pcev ON pcev.id = pcea.event_id
		WHERE pcev.class_id = pce.class_id AND pcea.user_id = pce.user_id
		  AND pcea.attendance_status IN ('present', 'partial')) AS sessions_attended`
const sessionsTotalSubquery = `(SELECT COUNT(*) FROM program_class_event_attendance pcea
		JOIN program_class_events pcev ON pcev.id = pcea.event_id
		WHERE pcev.class_id = pce.class_id AND pcea.user_id = pce.user_id
		  AND pcea.attendance_status IS NOT NULL AND pcea.attendance_status != '') AS total_sessions`

func (db *DB) GenerateAttendanceReport(ctx context.Context, req *models.ReportGenerateRequest) ([]models.AttendanceReportRow, error) {
	var rows []models.AttendanceReportRow

	tx := db.WithContext(ctx).Table("program_class_event_attendance pcea").
		Select(`
			f.name AS facility_name,
			p.name AS program_name,
			pc.name AS class_name,
			DATE(pcea.date) AS date,
			u.name_last AS student_last_name,
			u.name_first AS student_first_name,
			u.doc_id,
			pcea.attendance_status,
			NULL AS seat_time_minutes,
			(
				SELECT CONCAT(admin.name_first, ' ', admin.name_last)
				FROM user_account_history uah
				JOIN users admin ON admin.id = uah.admin_id
				WHERE uah.user_id = pcea.user_id
				  AND uah.action = 'attendance_recorded'
				  AND uah.session_date = DATE(pcea.date)
				  AND uah.class_name = pc.name
				  AND uah.attendance_status = pcea.attendance_status
				ORDER BY uah.created_at DESC
				LIMIT 1
			) AS recorded_by,
			pcea.note AS absence_reason
		`).
		Joins("JOIN program_class_events pce ON pce.id = pcea.event_id").
		Joins("JOIN program_classes pc ON pc.id = pce.class_id").
		Joins("JOIN programs p ON p.id = pc.program_id").
		Joins("JOIN users u ON u.id = pcea.user_id").
		Joins("JOIN facilities f ON f.id = u.facility_id").
		Where("DATE(pcea.date) >= ? AND DATE(pcea.date) <= ?", req.StartDate, req.EndDate).
		Where("pcea.deleted_at IS NULL").
		Order("f.name, p.name, pc.name, pcea.date, u.name_last")

	if req.FacilityID != nil {
		tx = tx.Where("f.id = ?", *req.FacilityID)
	}

	if req.ProgramID != nil {
		tx = tx.Where("p.id = ?", *req.ProgramID)
	}

	if req.ClassID != nil {
		tx = tx.Where("pc.id = ?", *req.ClassID)
	}

	if req.UserID != nil {
		tx = tx.Where("u.id = ?", *req.UserID)
	}

	if err := tx.Scan(&rows).Error; err != nil {
		return nil, newGetRecordsDBError(err, "attendance report")
	}

	return rows, nil
}

func (db *DB) GenerateProgramOutcomesReport(ctx context.Context, req *models.ReportGenerateRequest) ([]models.ProgramOutcomesReportRow, error) {
	var rows []models.ProgramOutcomesReportRow

	typeAgg := "STRING_AGG(DISTINCT CAST(program_type AS TEXT), ',')"
	if db.Name() == "sqlite" {
		typeAgg = "GROUP_CONCAT(DISTINCT CAST(program_type AS TEXT))"
	}
	classStatus := "Active"
	if req.ClassStatus != nil && *req.ClassStatus != "" {
		classStatus = *req.ClassStatus
	}
	classClause := "WHERE pc.status = 'Active'"
	switch classStatus {
	case "Not Active":
		classClause = "WHERE pc.status != 'Active'"
	case "All":
		classClause = ""
	}

	args := []any{req.StartDate, req.EndDate}
	var whereClauses []string
	if len(req.FacilityIDs) > 0 {
		whereClauses = append(whereClauses, "fp.facility_id IN ?")
		args = append(args, req.FacilityIDs)
	} else if req.FacilityID != nil {
		whereClauses = append(whereClauses, "fp.facility_id = ?")
		args = append(args, *req.FacilityID)
	}
	if len(req.ProgramIDs) > 0 {
		whereClauses = append(whereClauses, "p.id IN ?")
		args = append(args, req.ProgramIDs)
	} else if req.ProgramID != nil {
		whereClauses = append(whereClauses, "p.id = ?")
		args = append(args, *req.ProgramID)
	}
	if len(req.ProgramTypes) > 0 {
		whereClauses = append(whereClauses, "EXISTS (SELECT 1 FROM program_types pt2 WHERE pt2.program_id = p.id AND pt2.program_type IN ?)")
		args = append(args, req.ProgramTypes)
	}
	if len(req.FundingTypes) > 0 {
		whereClauses = append(whereClauses, "p.funding_type IN ?")
		args = append(args, req.FundingTypes)
	}
	// Archived programs are never exported; the caller opts in to inactive
	// (is_active = false) programs via IncludeInactive.
	whereClauses = append(whereClauses, "p.archived_at IS NULL")
	if !req.IncludeInactive {
		whereClauses = append(whereClauses, "p.is_active = ?")
		args = append(args, true)
	}
	whereClause := ""
	if len(whereClauses) > 0 {
		whereClause = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	query := fmt.Sprintf(`WITH active_classes AS (
			SELECT pc.id AS class_id, pc.program_id, pc.facility_id, pc.capacity
			FROM program_classes pc
			%s
		),
		enrollment_stats AS (
			SELECT pce.class_id,
				-- "Enrolled in Range": enrollments whose enrolled_at falls in the window.
				COUNT(CASE WHEN pce.enrolled_at BETWEEN ? AND ? THEN 1 END) AS total_enrollments,
				-- "Currently Enrolled": live snapshot of active enrollments, not date-scoped.
				COUNT(CASE WHEN pce.enrollment_status = 'Enrolled' THEN 1 END) AS active_enrollments
			FROM program_class_enrollments pce
			GROUP BY pce.class_id
		),
		program_types_agg AS (
			SELECT program_id, COALESCE(%s, 'N/A') AS program_type
			FROM program_types
			GROUP BY program_id
		)
		SELECT
			p.name AS program_name,
			p.is_active AS is_active,
			COALESCE(pta.program_type, 'N/A') AS program_type,
			COUNT(DISTINCT fp.facility_id) AS facilities_active,
			COUNT(DISTINCT ac.class_id) AS total_classes,
			COALESCE(SUM(es.active_enrollments), 0) AS active_enrollments,
			COALESCE(SUM(es.total_enrollments), 0) AS total_enrollments,
			COALESCE(SUM(ac.capacity), 0) AS total_capacity
		FROM programs p
		JOIN facilities_programs fp ON fp.program_id = p.id
		LEFT JOIN active_classes ac ON ac.program_id = fp.program_id AND ac.facility_id = fp.facility_id
		LEFT JOIN enrollment_stats es ON es.class_id = ac.class_id
		LEFT JOIN program_types_agg pta ON pta.program_id = p.id
		%s
		GROUP BY p.id, p.name, pta.program_type
		ORDER BY p.name`, classClause, typeAgg, whereClause)

	if err := db.WithContext(ctx).Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program outcomes report")
	}

	for i := range rows { //FIXME business logic left here for now, need to clean this entire file up when the time is right
		if rows[i].TotalCapacity > 0 {
			rows[i].Utilization = int(math.Round(
				100.0 * float64(rows[i].ActiveEnrollments) / float64(rows[i].TotalCapacity),
			))
		}
	}

	return rows, nil
}

func (db *DB) GenerateProgramClassBreakdown(ctx context.Context, req *models.ReportGenerateRequest, programID, facilityID uint) ([]models.ProgramClassBreakdownRow, error) {
	var rows []models.ProgramClassBreakdownRow

	tx := db.WithContext(ctx).Table("program_classes pc").
		Select(`
			pc.name AS class_name,
			pc.status AS status,
			pc.credit_hours AS credit_hours,
			pc.capacity AS capacity,
			COUNT(CASE WHEN pce.enrollment_status = 'Enrolled' THEN 1 END) AS active_enrollments,
			COUNT(CASE WHEN pce.enrolled_at BETWEEN ? AND ? THEN 1 END) AS range_enrollments
		`, req.StartDate, req.EndDate).
		Joins("LEFT JOIN program_class_enrollments pce ON pce.class_id = pc.id AND pce.deleted_at IS NULL").
		Where("pc.program_id = ? AND pc.facility_id = ?", programID, facilityID)

	switch {
	case req.ClassStatus != nil && *req.ClassStatus == "All":
	case req.ClassStatus != nil && *req.ClassStatus == "Not Active":
		tx = tx.Where("pc.status != ?", "Active")
	default:
		tx = tx.Where("pc.status = ?", "Active")
	}

	tx = tx.Group("pc.id, pc.name, pc.status, pc.credit_hours, pc.capacity").
		Order("pc.name")

	if err := tx.Scan(&rows).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program class breakdown")
	}

	return rows, nil
}

func (db *DB) GenerateFacilityComparisonReport(ctx context.Context, req *models.ReportGenerateRequest, facilityIDs []uint) ([]models.FacilityComparisonReportRow, error) {
	var rows []models.FacilityComparisonReportRow

	tx := db.WithContext(ctx).Table("facilities f").
		Select(`
			f.name AS facility_name,
			COUNT(DISTINCT fp.program_id) AS total_programs,
			COUNT(DISTINCT CASE WHEN p.deleted_at IS NULL AND pce.id IS NOT NULL THEN fp.program_id END) AS active_programs,
			COUNT(DISTINCT CASE WHEN pce.enrolled_at IS NOT NULL THEN pce.id END) AS total_enrollments,
			COUNT(DISTINCT CASE WHEN pce.enrollment_status = 'Enrolled' THEN pce.id END) AS active_enrollments,
			CASE
				WHEN COUNT(CASE WHEN pce.enrolled_at IS NOT NULL THEN 1 END) = 0 THEN 0
				ELSE (CAST(COUNT(CASE WHEN pce.enrollment_status = 'Completed' THEN 1 END) AS REAL) * 100.0 /
					NULLIF(COUNT(CASE WHEN pce.enrolled_at IS NOT NULL THEN 1 END), 0))
			END AS completion_rate,
			COALESCE(
				SUM(CASE WHEN pcea.attendance_status = 'present' THEN 1 ELSE 0 END) * 100.0 /
				NULLIF(COUNT(CASE WHEN pcea.attendance_status IS NOT NULL AND pcea.attendance_status != '' THEN 1 END), 0),
				0
			) AS attendance_rate,
			COALESCE(
				(SELECT CAST(pt2.program_type AS TEXT)
				 FROM program_types pt2
				 JOIN programs p2 ON p2.id = pt2.program_id
				 JOIN facilities_programs fp2 ON fp2.program_id = p2.id
				 WHERE fp2.facility_id = f.id
				 GROUP BY pt2.program_type
				 ORDER BY COUNT(*) DESC
				 LIMIT 1),
				'N/A') AS top_program_type,
			COALESCE((SELECT SUM(credit_hours) FROM program_classes WHERE facility_id = f.id), 0) AS total_credit_hours,
			0 AS certificates_earned,
			MAX(pcea.created_at) AS last_activity_date
		`).
		Joins("LEFT JOIN facilities_programs fp ON fp.facility_id = f.id").
		Joins("LEFT JOIN programs p ON p.id = fp.program_id").
		Joins("LEFT JOIN program_classes pc ON pc.program_id = p.id AND pc.facility_id = f.id").
		Joins("LEFT JOIN program_class_enrollments pce ON pce.class_id = pc.id AND pce.enrolled_at <= ?", req.EndDate).
		Joins("LEFT JOIN program_class_events pcev ON pcev.class_id = pc.id").
		Joins("LEFT JOIN program_class_event_attendance pcea ON pcea.event_id = pcev.id AND pcea.user_id = pce.user_id AND pcea.deleted_at IS NULL AND DATE(pcea.date) BETWEEN ? AND ?", req.StartDate, req.EndDate).
		Where("f.id IN ?", facilityIDs)

	if len(req.ProgramTypes) > 0 {
		tx = tx.Where("EXISTS (SELECT 1 FROM program_types pt WHERE pt.program_id = p.id AND pt.program_type IN ?)", req.ProgramTypes)
	}

	if len(req.FundingTypes) > 0 {
		tx = tx.Where("p.funding_type IN ?", req.FundingTypes)
	}

	tx = tx.Group("f.id, f.name").
		Order("f.name")

	if err := tx.Scan(&rows).Error; err != nil {
		return nil, newGetRecordsDBError(err, "facility comparison report")
	}

	return rows, nil
}

func mapRosterStatuses(labels []string) []string {
	mapped := make([]string, 0, len(labels))
	for _, label := range labels {
		if stored, ok := rosterStatusFilterMap[label]; ok {
			mapped = append(mapped, stored)
		} else {
			mapped = append(mapped, label)
		}
	}
	return mapped
}

func (db *DB) GenerateClassRosterReport(ctx context.Context, req *models.ReportGenerateRequest) ([]models.ClassRosterReportRow, error) {
	var rows []models.ClassRosterReportRow

	tx := db.WithContext(ctx).Table("program_class_enrollments pce").
		Select(`
			u.name_last,
			u.name_first,
			u.doc_id,
			pce.enrollment_status,
			pce.enrolled_at,
			pce.enrollment_ended_at AS ended_at,
			`+sessionsAttendedSubquery+`,
			`+sessionsTotalSubquery+`
		`).
		Joins("JOIN users u ON u.id = pce.user_id").
		Joins("JOIN program_classes pc ON pc.id = pce.class_id").
		Where("pce.class_id = ?", *req.ClassID).
		Where("pce.deleted_at IS NULL").
		Order("u.name_last, u.name_first")

	if len(req.EnrollmentStatuses) > 0 {
		tx = tx.Where("pce.enrollment_status IN ?", mapRosterStatuses(req.EnrollmentStatuses))
	}

	if req.FacilityID != nil {
		tx = tx.Where("pc.facility_id = ?", *req.FacilityID)
	}

	if err := tx.Scan(&rows).Error; err != nil {
		return nil, newGetRecordsDBError(err, "class roster report")
	}

	return rows, nil
}

func (db *DB) GenerateResidentProfileReport(ctx context.Context, req *models.ReportGenerateRequest) ([]models.ResidentProfileReportRow, error) {
	var rows []models.ResidentProfileReportRow

	tx := db.WithContext(ctx).Table("program_class_enrollments pce").
		Select(`
			u.name_last,
			u.name_first,
			u.doc_id,
			f.name AS facility_name,
			p.name AS program_name,
			pc.name AS class_name,
			pce.enrollment_status,
			pce.enrolled_at,
			pce.enrollment_ended_at AS ended_at,
			`+sessionsAttendedSubquery+`,
			`+sessionsTotalSubquery+`
		`).
		Joins("JOIN users u ON u.id = pce.user_id").
		Joins("JOIN program_classes pc ON pc.id = pce.class_id").
		Joins("JOIN programs p ON p.id = pc.program_id").
		Joins("JOIN facilities f ON f.id = pc.facility_id").
		Where("pce.user_id = ?", *req.UserID).
		Where("pce.deleted_at IS NULL").
		Order("pce.enrolled_at DESC")

	if req.FacilityID != nil {
		tx = tx.Where("pc.facility_id = ?", *req.FacilityID)
	}

	if err := tx.Scan(&rows).Error; err != nil {
		return nil, newGetRecordsDBError(err, "resident profile report")
	}

	return rows, nil
}
