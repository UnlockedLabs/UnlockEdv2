package database

import (
	"UnlockEdv2/src/models"
	"context"
)

func (db *DB) GenerateAttendanceReport(ctx context.Context, req *models.ReportGenerateRequest, facilityID uint) ([]models.AttendanceReportRow, error) {
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
			pcea.note AS absence_reason
		`).
		Joins("JOIN program_class_events pce ON pce.id = pcea.event_id").
		Joins("JOIN program_classes pc ON pc.id = pce.class_id").
		Joins("JOIN programs p ON p.id = pc.program_id").
		Joins("JOIN users u ON u.id = pcea.user_id").
		Joins("JOIN facilities f ON f.id = u.facility_id").
		Where("DATE(pcea.date) >= ? AND DATE(pcea.date) <= ?", req.StartDate, req.EndDate).
		Order("f.name, p.name, pc.name, pcea.date, u.name_last")

	if req.FacilityID != nil {
		tx = tx.Where("f.id = ?", *req.FacilityID)
	} else if facilityID > 0 {
		tx = tx.Where("f.id = ?", facilityID)
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

func (db *DB) GenerateProgramOutcomesReport(ctx context.Context, req *models.ReportGenerateRequest, facilityID uint) ([]models.ProgramOutcomesReportRow, error) {
	var rows []models.ProgramOutcomesReportRow

	aggFunc := "STRING_AGG(DISTINCT CAST(pt.program_type AS TEXT), ',')"
	if db.Name() == "sqlite" {
		aggFunc = "GROUP_CONCAT(DISTINCT CAST(pt.program_type AS TEXT))"
	}

	query := `
			f.name AS facility_name,
			p.name AS program_name,
			COALESCE(` + aggFunc + `, 'N/A') AS program_type,
			COALESCE(CAST(p.funding_type AS TEXT), 'N/A') AS funding_type,
			COUNT(DISTINCT CASE WHEN pce.enrolled_at IS NOT NULL THEN pce.id END) AS total_enrollments,
			COUNT(DISTINCT CASE WHEN pce.enrollment_status = 'Enrolled' THEN pce.id END) AS active_enrollments,
			COUNT(DISTINCT CASE WHEN pce.enrollment_status = 'Completed' THEN pce.id END) AS completed_enrollments,
			COUNT(DISTINCT CASE WHEN pce.enrollment_status LIKE 'Incomplete:%' THEN pce.id END) AS dropped_enrollments,
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
			COALESCE(SUM(DISTINCT pc.credit_hours), 0) AS total_credit_hours,
			0 AS certificates_earned
		`

	tx := db.WithContext(ctx).Table("programs p").
		Select(query).
		Joins("JOIN facilities_programs fp ON fp.program_id = p.id").
		Joins("JOIN facilities f ON f.id = fp.facility_id").
		Joins("LEFT JOIN program_classes pc ON pc.program_id = p.id").
		Joins("LEFT JOIN program_class_enrollments pce ON pce.class_id = pc.id AND pce.enrolled_at <= ?", req.EndDate).
		Joins("LEFT JOIN program_types pt ON pt.program_id = p.id").
		Joins("LEFT JOIN program_class_events pcev ON pcev.class_id = pc.id").
		Joins("LEFT JOIN program_class_event_attendance pcea ON pcea.event_id = pcev.id AND pcea.user_id = pce.user_id AND DATE(pcea.date) BETWEEN ? AND ?", req.StartDate, req.EndDate).
		Group("f.id, f.name, p.id, p.name, p.funding_type").
		Order("f.name, p.name")

	if req.FacilityID != nil {
		tx = tx.Where("f.id = ?", *req.FacilityID)
	}

	if req.ProgramID != nil {
		tx = tx.Where("p.id = ?", *req.ProgramID)
	}

	classStatus := "Active"
	if req.ClassStatus != nil {
		classStatus = *req.ClassStatus
	}
	switch classStatus {
	case "Active":
		tx = tx.Where("pc.status = ?", "Active")
	case "Not Active":
		tx = tx.Where("pc.status != ?", "Active")
	}

	if len(req.ProgramTypes) > 0 {
		tx = tx.Where("EXISTS (SELECT 1 FROM program_types pt2 WHERE pt2.program_id = p.id AND pt2.program_type IN ?)", req.ProgramTypes)
	}

	if len(req.FundingTypes) > 0 {
		tx = tx.Where("p.funding_type IN ?", req.FundingTypes)
	}

	if err := tx.Scan(&rows).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program outcomes report")
	}

	return rows, nil
}

func (db *DB) GenerateFacilityComparisonReport(ctx context.Context, req *models.ReportGenerateRequest, facilityIDs []uint) ([]models.FacilityComparisonReportRow, error) {
	var rows []models.FacilityComparisonReportRow

	tx := db.WithContext(ctx).Table("facilities f").
		Select(`
			f.name AS facility_name,
			COUNT(DISTINCT fp.program_id) AS total_programs,
			COUNT(DISTINCT CASE WHEN p.deleted_at IS NULL THEN fp.program_id END) AS active_programs,
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
			COALESCE(SUM(DISTINCT pc.credit_hours), 0) AS total_credit_hours,
			0 AS certificates_earned,
			MAX(pcea.created_at) AS last_activity_date
		`).
		Joins("LEFT JOIN facilities_programs fp ON fp.facility_id = f.id").
		Joins("LEFT JOIN programs p ON p.id = fp.program_id").
		Joins("LEFT JOIN program_classes pc ON pc.program_id = p.id AND pc.facility_id = f.id").
		Joins("LEFT JOIN program_class_enrollments pce ON pce.class_id = pc.id AND pce.enrolled_at <= ?", req.EndDate).
		Joins("LEFT JOIN program_class_events pcev ON pcev.class_id = pc.id").
		Joins("LEFT JOIN program_class_event_attendance pcea ON pcea.event_id = pcev.id AND pcea.user_id = pce.user_id AND DATE(pcea.date) BETWEEN ? AND ?", req.StartDate, req.EndDate).
		Where("f.id IN ?", facilityIDs)

	if len(req.ProgramTypes) > 0 {
		tx = tx.Joins("LEFT JOIN program_types pt ON pt.program_id = p.id").
			Where("pt.program_type IN ?", req.ProgramTypes)
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
