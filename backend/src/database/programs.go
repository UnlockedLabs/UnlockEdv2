package database

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/models"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
)

type EnrollmentAndCompletionMetrics struct {
	ActiveEnrollments int     `json:"active_enrollments"`
	Completions       int     `json:"completions"`
	TotalEnrollments  int     `json:"total_enrollments"`
	CompletionRate    float64 `json:"completion_rate"`
}

func (db *DB) GetProgramByID(id int) (*models.Program, error) {
	content := &models.Program{}
	if err := db.Preload("Facilities").Preload("ProgramTypes").Preload("ProgramCreditTypes").First(content, id).Error; err != nil {
		return nil, newNotFoundDBError(err, "programs")
	}
	return content, nil
}

func (db *DB) FetchEnrollmentMetrics(programID int, facilityId uint) (EnrollmentAndCompletionMetrics, error) {
	var metrics EnrollmentAndCompletionMetrics

	const query = `
		COUNT(CASE WHEN pce.enrollment_status = 'Enrolled' THEN 1 END) AS active_enrollments,
		COUNT(CASE WHEN pce.enrollment_status = 'Completed' THEN 1 END) AS completions,
		COUNT(*) AS total_enrollments,
		CASE 
			WHEN COUNT(*) = 0 THEN 0
			WHEN COUNT(CASE WHEN pce.enrollment_status = 'Enrolled' THEN 1 END) = 0
				AND COUNT(CASE WHEN pce.enrollment_status = 'Completed' THEN 1 END) = COUNT(*) 
			THEN 100
			ELSE COUNT(CASE WHEN pce.enrollment_status = 'Completed' THEN 1 END) * 1.0 / COUNT(*) * 100
		END AS completion_rate
	`

	err := db.Table("program_class_enrollments pce").
		Select(query).
		Joins("JOIN program_classes pc ON pce.class_id = pc.id").
		Where("pc.program_id = ?", programID).
		Where("pc.facility_id = ?", facilityId).
		Scan(&metrics).Error

	return metrics, err
}

func (db *DB) GetPrograms(args *models.QueryContext) ([]models.Program, error) {
	content := make([]models.Program, 0, args.PerPage)
	tx := db.WithContext(args.Ctx).Model(&models.Program{}).
		Preload("Facilities").
		Preload("Favorites", "user_id = ?", args.UserID).
		Preload("ProgramTypes").
		Preload("ProgramCreditTypes")
	if len(args.Tags) > 0 {
		tx = tx.Joins("JOIN program_types t ON t.program_id = programs.id").Where("t.id IN (?)", args.Tags)
	}

	if args.OrderBy != "" {
		tx = tx.Order(args.OrderClause())
	}

	if args.Search != "" {
		tx = tx.Where("LOWER(name) LIKE ? OR LOWER(description) LIKE ? ", args.SearchQuery(), args.SearchQuery())
	}

	if err := tx.Count(&args.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "programs")
	}
	if err := tx.Limit(args.PerPage).Offset(args.CalcOffset()).Find(&content).Error; err != nil {
		return nil, newGetRecordsDBError(err, "programs")
	}
	programs := src.IterMap(func(prog models.Program) models.Program {
		if len(prog.Favorites) > 0 {
			prog.IsFavorited = true
			return prog
		}
		return prog
	}, content)
	return programs, nil
}

func (db *DB) CreateProgram(content *models.Program) error {
	err := Validate().Struct(content)
	if err != nil {
		return NewDBError(err, "create programs validation error")
	}
	if err := db.Create(content).Error; err != nil {
		return newCreateDBError(err, "programs")
	}
	return nil
}

func (db *DB) UpdateProgram(content *models.Program) (*models.Program, error) {
	if err := db.Save(content).Error; err != nil {
		return nil, newUpdateDBError(err, "programs")
	}
	return content, nil
}

func (db *DB) UpdateProgramStatus(programUpdate map[string]any, id int) (bool, error) {
	var count int64
	err := db.Model(&models.ProgramClass{}).Where("program_id = ? and status IN ?", id, []models.ClassStatus{models.Active, models.Scheduled}).Count(&count).Error
	if err != nil {
		return false, newGetRecordsDBError(err, "program_classes")
	}
	if count > 0 && programUpdate["archived_at"] != nil {
		return false, nil
	}
	if err := db.Model(&models.Program{}).Where("id = ?", id).Updates(programUpdate).Error; err != nil {
		return false, newUpdateDBError(err, "program status")
	}
	return true, nil
}

func (db *DB) DeleteProgram(id int) error {
	if err := db.Delete(&models.Program{}, id).Error; err != nil {
		return newDeleteDBError(err, "programs")
	}
	return nil
}

func (db *DB) GetProgramsFacilitiesStats(args *models.QueryContext, timeFilter int) (models.ProgramsFacilitiesStats, error) {
	var programsFacilitiesStats models.ProgramsFacilitiesStats
	var totals struct {
		TotalPrograms    int64 `json:"total_programs"`
		TotalEnrollments int64 `json:"total_enrollments"`
	}
	if err := db.WithContext(args.Ctx).Model(&models.DailyProgramsFacilitiesHistory{}).
		Select("total_programs, total_enrollments").
		Order("date DESC").
		First(&totals).Error; err != nil {
		// these are default initialized to zero, so we can safely ignore this error as the table may not
		// have records in it yet.
		logrus.Warn("daily program failicies history queried before records are inserted")
	}
	tx := db.WithContext(args.Ctx).Model(&models.DailyProgramsFacilitiesHistory{}).
		Select(`
		COALESCE(SUM(total_program_offerings) / NULLIF(SUM(total_facilities), 0), 0) AS avg_active_programs_per_facility,
		COALESCE(SUM(total_students_present) * 1.0 / NULLIF(SUM(total_attendances_marked), 0), 0) * 100 AS attendance_rate,
		COALESCE(SUM(total_completions) * 1.0 / NULLIF(SUM(total_enrollments), 0), 0) * 100 AS completion_rate
	`)
	if timeFilter > 0 {
		tx = tx.Where("date >= ?", time.Now().AddDate(0, 0, -timeFilter))
	}
	if err := tx.Scan(&programsFacilitiesStats).Error; err != nil {
		return programsFacilitiesStats, newGetRecordsDBError(err, "programs facilities stats")
	}
	programsFacilitiesStats.TotalPrograms = &totals.TotalPrograms
	programsFacilitiesStats.TotalEnrollments = &totals.TotalEnrollments
	return programsFacilitiesStats, nil
}

func (db *DB) GetProgramsFacilityStats(args *models.QueryContext, timeFilter int) (models.ProgramsFacilitiesStats, error) {
	var programsFacilityStats models.ProgramsFacilitiesStats
	tx := db.WithContext(args.Ctx).Model(&models.DailyProgramFacilityHistory{}).
		Select(`
		COUNT(*) AS total_programs,
		SUM(total_enrollments) AS total_enrollments,
		SUM(total_students_present) * 1.0 / NULLIF(SUM(total_attendances_marked), 0) * 100 AS attendance_rate,
		SUM(total_completions) * 1.0 / NULLIF(SUM(total_enrollments), 0) * 100 AS completion_rate
	`).Where("facility_id = ?", args.FacilityID)
	if timeFilter > 0 {
		tx = tx.Where("date >= ?", time.Now().AddDate(0, 0, -timeFilter))
	}
	if err := tx.Scan(&programsFacilityStats).Error; err != nil {
		return programsFacilityStats, newGetRecordsDBError(err, "programs facilities stats")
	}
	return programsFacilityStats, nil
}

func (db *DB) GetProgramsOverviewTable(args *models.QueryContext, timeFilter int, includeArchived bool, adminRole models.UserRole) ([]models.ProgramsOverviewTable, error) {
	var programsTable []models.ProgramsOverviewTable
	var tableName string
	var totalActiveFacilitiesQuery string
	var totalActiveFacilitiesSubQuery string
	var facilitySubQueryFilter string
	if adminRole == models.FacilityAdmin {
		tableName = "daily_program_facility_history"
		facilitySubQueryFilter = fmt.Sprintf("AND facility_id = %d", args.FacilityID)
	} else {
		tableName = "daily_program_facilities_history"
		totalActiveFacilitiesQuery = "mr.total_active_facilities,"
		totalActiveFacilitiesSubQuery = "total_active_facilities,"
	}
	tx := db.WithContext(args.Ctx).Model(&models.Program{}).
		Select(fmt.Sprintf(`
			programs.id AS program_id,
			programs.name AS program_name,
			programs.archived_at AS archived_at,
			%s
			mr.total_enrollments AS total_enrollments,
			mr.total_active_enrollments AS total_active_enrollments,
			mr.total_classes AS total_classes,
			(SUM(total_completions) * 1.0 / NULLIF(SUM(dpfh.total_enrollments), 0)) * 100 AS completion_rate,
			(SUM(total_students_present) * 1.0 / NULLIF(SUM(dpfh.total_attendances_marked), 0)) * 100 AS attendance_rate,
			STRING_AGG(DISTINCT pt.program_type::text, ',') AS program_types,
			STRING_AGG(DISTINCT pct.credit_type::text, ',') AS credit_types,
			programs.funding_type AS funding_type,
			BOOL_OR(programs.is_active) AS status
		`, totalActiveFacilitiesQuery))
	if timeFilter > 0 {
		joinCondition := fmt.Sprintf(`LEFT JOIN %s AS dpfh ON dpfh.program_id = programs.id AND dpfh.date >= ?`, tableName)
		tx = tx.Joins(joinCondition, time.Now().AddDate(0, 0, -timeFilter))
	} else {
		tx = tx.Joins(fmt.Sprintf(`LEFT JOIN %s AS dpfh ON dpfh.program_id = programs.id`, tableName))
	}
	tx = tx.Joins(fmt.Sprintf(`
			LEFT JOIN (
				SELECT 
					program_id,
					%s
					total_enrollments,
					total_active_enrollments,
					total_classes
				FROM %s
				WHERE date = (SELECT MAX(date) FROM %s)
				%s
			) AS mr ON mr.program_id = programs.id
		`, totalActiveFacilitiesSubQuery, tableName, tableName, facilitySubQueryFilter))
	tx = tx.Joins("JOIN program_types pt ON pt.program_id = programs.id").
		Joins("JOIN program_credit_types pct ON pct.program_id = programs.id").
		Group(totalActiveFacilitiesQuery + "programs.id, programs.name, mr.total_enrollments, mr.total_active_enrollments, mr.total_classes, programs.funding_type")
	if adminRole == models.FacilityAdmin {
		tx = tx.Joins("JOIN facilities_programs fp ON fp.program_id = programs.id").Where("fp.facility_id = ?", args.FacilityID)
	}
	if !includeArchived {
		tx = tx.Where("programs.archived_at IS NULL")
	}
	if len(args.Tags) > 0 {
		tx = tx.Where("pt.program_id IN (?)", args.Tags)
	}
	if args.OrderBy != "" {
		tx = tx.Order(args.OrderClause())
	}
	if args.Search != "" {
		tx = tx.Where("LOWER(name) LIKE ? OR LOWER(description) LIKE ? ", args.SearchQuery(), args.SearchQuery())
	}
	if err := tx.Count(&args.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "programs table")
	}
	if err := tx.Limit(args.PerPage).Offset(args.CalcOffset()).Scan(&programsTable).Error; err != nil {
		return programsTable, newGetRecordsDBError(err, "programs table")
	}
	return programsTable, nil

}

func (db *DB) GetProgramCreatedAtAndBy(id int, args *models.QueryContext) (models.ActivityHistoryResponse, error) {
	var programDetails models.ActivityHistoryResponse
	if err := db.WithContext(args.Ctx).Table("programs p").
		Select("p.created_at, u.username as admin_username").
		Joins("join users u on u.id = p.create_user_id").
		Where("p.id = ?", id).
		Scan(&programDetails).Error; err != nil {
		return programDetails, newNotFoundDBError(err, "programs")
	}
	return programDetails, nil
}
