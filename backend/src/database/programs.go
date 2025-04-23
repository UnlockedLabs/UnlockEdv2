package database

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/models"
	"time"
)

type EnrollmentAndCompletionMetrics struct {
	ActiveEnrollments int     `json:"active_enrollments"`
	Completions       int     `json:"completions"`
	TotalEnrollments  int     `json:"total_enrollments"`
	CompletionRate    float64 `json:"completion_rate"`
}


func (db *DB) GetProgramByID(id int) (*models.Program, error) {
	content := &models.Program{}
	if err := db.Preload("Facilities").First(content, id).Error; err != nil {
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

func (db *DB) CreateProgram(content *models.Program, types *models.ProgramTypeInfo) error {
	err := Validate().Struct(content)
	if err != nil {
		return NewDBError(err, "create programs validation error")
	}

	if err := db.Create(content).Error; err != nil {
		return newCreateDBError(err, "programs")
	}
	for _, credit := range types.ProgramCreditTypes {
		var creditType models.ProgramCreditType
		creditType.CreditType = credit
		creditType.ProgramID = content.ID
		if err := db.Create(creditType).Error; err != nil {
			return newCreateDBError(err, "credit type")
		}
	}
	for _, programType := range types.ProgramTypes {
		var programTypes models.ProgramType
		programTypes.ProgramType = programType
		programTypes.ProgramID = content.ID
		if err := db.Create(programTypes).Error; err != nil {
			return newCreateDBError(err, "credit type")
		}
	}
	return nil
}

func (db *DB) UpdateProgram(content *models.Program) (*models.Program, error) {
	if err := db.Save(content).Error; err != nil {
		return nil, newUpdateDBError(err, "programs")
	}
	return content, nil
}

func (db *DB) DeleteProgram(id int) error {
	if err := db.Delete(&models.Program{}, id).Error; err != nil {
		return newDeleteDBError(err, "programs")
	}
	return nil
}

func (db *DB) GetProgramsOverview(args *models.QueryContext, timeFilter int) (models.ProgramsOverview, error) {
	var programsOverview models.ProgramsOverview
	// get programs facilties calculations
	var programsFacilitiesStats models.ProgramsFacilitiesStats
	if err := db.WithContext(args.Ctx).Model(&models.DailyProgramsFacilitiesHistory{}).
		Select("total_programs, total_enrollments").
		Order("date DESC").
		First(&programsFacilitiesStats).Error; err != nil {
		return programsOverview, newGetRecordsDBError(err, "programs facilities stats")
	}
	tx := db.WithContext(args.Ctx).Model(&models.DailyProgramsFacilitiesHistory{}).
		Select(`
		SUM(total_program_offerings) / SUM(total_facilities) as avg_active_programs_per_facility,
		SUM(total_students_present) / SUM(total_enrollments) as attendance_rate,
		SUM(total_completions) / SUM(total_enrollments) as completion_rate
		`)
	if timeFilter > 0 {
		tx = tx.Where("date >= ?", time.Now().AddDate(0, 0, -timeFilter))
	}
	if err := tx.Scan(&programsFacilitiesStats).Error; err != nil {
		return programsOverview, newGetRecordsDBError(err, "programs facilities stats")
	}
	programsOverview.ProgramsFacilitiesStats = programsFacilitiesStats
	// get programs table
	var programsTable []models.ProgramsOverviewTable
	tx = db.WithContext(args.Ctx).Model(&models.DailyProgramFacilitiesHistory{}).
		Select(`
			programs.id,
			programs.name,
			SUM(total_active_facilities) as total_active_facilities,
			SUM(total_enrollments) as total_enrollments,
			SUM(total_active_enrollments) as total_active_enrollments,
			SUM(total_classes) as total_classes,
			SUM(total_completions) / SUM(total_enrollments) as completion_rate,
			SUM(total_students_present) / SUM(total_enrollments) as attendance_rate,
			pt.program_type,
			pct.credit_type,
			programs.funding_type,
			programs.is_active as status
		`).
		Joins("JOIN programs ON programs.id = daily_program_facilities_history.program_id").
		Joins("JOIN program_types pt ON pt.program_id = daily_program_facilities_history.program_id").
		Joins("JOIN program_credit_types pct ON pct.program_id = daily_program_facilities_history.program_id")
	if timeFilter > 0 {
		tx = tx.Where("daily_program_facilities_history.date >= ?", time.Now().AddDate(0, 0, -timeFilter))
	}
	if err := tx.Group("programs.id").Scan(&programsTable).Error; err != nil {
		return programsOverview, newGetRecordsDBError(err, "programs table")
	}
	programsOverview.ProgramsTable = programsTable
	return programsOverview, nil

}
