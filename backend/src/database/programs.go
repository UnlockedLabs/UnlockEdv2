package database

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/models"
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

func (db *DB) GetProgramByID(id int) (*models.Program, error) {
	content := &models.Program{}
	if err := db.Preload("ProgramTypes").Preload("ProgramCreditTypes").Preload("FacilitiesPrograms.Facility").First(content, id).Error; err != nil {
		return nil, newNotFoundDBError(err, "programs")
	}

	for _, fp := range content.FacilitiesPrograms {
		if fp.Facility != nil {
			content.Facilities = append(content.Facilities, *fp.Facility)
		}
	}

	return content, nil
}

func (db *DB) FetchEnrollmentMetrics(programID int, facilityId uint) (*models.ProgramOverviewResponse, error) {
	var metrics models.ProgramOverviewResponse

	const query = `
		COUNT(CASE WHEN pce.enrollment_status = 'Enrolled' THEN 1 END) AS active_enrollments,
		COUNT(CASE WHEN pce.enrollment_status = 'Completed' THEN 1 END) AS completions,
		COUNT(*) AS total_enrollments,
		COUNT(DISTINCT CASE WHEN pce.enrollment_status = 'Enrolled' THEN pce.user_id END) as active_residents,
		CASE 
			WHEN COUNT(*) = 0 THEN 0
			WHEN COUNT(CASE WHEN pce.enrollment_status = 'Enrolled' THEN 1 END) = 0
				AND COUNT(CASE WHEN pce.enrollment_status = 'Completed' THEN 1 END) = COUNT(*) 
			THEN 100
			ELSE COUNT(CASE WHEN pce.enrollment_status = 'Completed' THEN 1 END) * 1.0 / COUNT(*) * 100
		END AS completion_rate
	`

	if err := db.Table("program_class_enrollments pce").
		Select(query).
		Joins("JOIN program_classes pc ON pce.class_id = pc.id").
		Where("pc.program_id = ?", programID).
		Where("pc.facility_id = ?", facilityId).
		Scan(&metrics).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_enrollments")
	}
	return &metrics, nil
}

func (db *DB) GetActiveClassFacilityIDs(ctx context.Context, id int) ([]int, error) {
	activeClassFacilityIDs := make([]int, 0)
	if err := db.WithContext(ctx).Model(&models.ProgramClass{}).Select("DISTINCT facility_id").
		Where("program_id = ? and status in ('Active', 'Scheduled')", id).
		Scan(&activeClassFacilityIDs).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_classes")
	}
	return activeClassFacilityIDs, nil
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
	tx = tx.Order(args.OrderClause("programs.created_at desc"))

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

func (db *DB) UpdateProgram(ctx context.Context, program *models.Program, facilityIds []int) (*models.Program, error) {
	var allChanges []models.ChangeLogEntry
	updatePrg, err := db.GetProgramByID(int(program.ID))
	if err != nil {
		return nil, err
	}
	//begin the transaction
	trans := db.WithContext(ctx).Begin() //only need to pass context here, it will be used/shared within the transaction
	if trans.Error != nil {
		return nil, NewDBError(trans.Error, "unable to start the database transaction")
	}
	ignoredFieldNames := []string{"create_user_id", "update_user_id", "program_types", "credit_types", "facilities", "archived_at"}
	programLogEntries := models.GenerateChangeLogEntries(updatePrg, program, "programs", updatePrg.ID, program.UpdateUserID, ignoredFieldNames)
	allChanges = append(allChanges, programLogEntries...)
	models.UpdateStruct(&updatePrg, &program)
	facLogEntries, err := updateFacilitiesPrograms(trans, updatePrg, facilityIds)
	if err != nil {
		trans.Rollback()
		return nil, err
	}
	allChanges = append(allChanges, facLogEntries...)
	prgTypeLogEntries, err := updateProgramTypes(trans, updatePrg, program.ProgramTypes)
	if err != nil {
		trans.Rollback()
		return nil, err
	}
	allChanges = append(allChanges, prgTypeLogEntries...)
	creditTypeLogEntries, err := updateProgramCreditTypes(trans, updatePrg, program.ProgramCreditTypes)
	if err != nil {
		trans.Rollback()
		return nil, err
	}
	allChanges = append(allChanges, creditTypeLogEntries...)
	if err := trans.Omit("Facilities", "CreatedAt").Select("IsActive", "Name", "Description", "FundingType", "UpdateUserID").Updates(&updatePrg).Error; err != nil {
		return nil, newUpdateDBError(err, "programs")
	}

	if len(allChanges) > 0 {
		if err := trans.Create(&allChanges).Error; err != nil {
			trans.Rollback()
			return nil, newCreateDBError(err, "change_log_entries")
		}
	}
	//end transaction
	if err := trans.Commit().Error; err != nil {
		return nil, NewDBError(err, "unable to commit the database transaction")
	}
	return updatePrg, nil
}

func updateFacilitiesPrograms(trans *gorm.DB, updateProgram *models.Program, facilityIds []int) ([]models.ChangeLogEntry, error) {
	var (
		currentFacPrgs []models.FacilitiesPrograms
		logEntries     []models.ChangeLogEntry
		facilityID     uint
	)
	if err := trans.Where("program_id = ?", updateProgram.ID).Find(&currentFacPrgs).Error; err != nil {
		return nil, newGetRecordsDBError(err, "facilities_programs")
	}

	currentFacPrgsMap := make(map[uint]struct{}, len(currentFacPrgs)) //added light weight map used for lookup
	for _, fp := range currentFacPrgs {
		currentFacPrgsMap[fp.FacilityID] = struct{}{}
	}

	updateFacPrgsMap := make(map[uint]struct{}, len(facilityIds)) //added light weight map used for lookup
	for _, facId := range facilityIds {
		facilityID = uint(facId)
		updateFacPrgsMap[facilityID] = struct{}{}
		if _, ok := currentFacPrgsMap[facilityID]; !ok {
			logEntries = append(logEntries, *models.NewChangeLogEntry("programs", "facility_id", nil, models.StringPtr(strconv.Itoa(int(facilityID))), updateProgram.ID, updateProgram.UpdateUserID))
			if err := trans.Create(&models.FacilitiesPrograms{
				ProgramID:  updateProgram.ID,
				FacilityID: facilityID,
			}).Error; err != nil {
				return nil, newCreateDBError(err, "facilities_programs")
			}
		}
	}

	for facId := range currentFacPrgsMap {
		if _, ok := updateFacPrgsMap[facId]; !ok { //delete entry
			logEntries = append(logEntries, *models.NewChangeLogEntry("programs", "facility_id", models.StringPtr(strconv.Itoa(int(facId))), nil, updateProgram.ID, updateProgram.UpdateUserID))
			if err := trans.Where("program_id = ? and facility_id = ?", updateProgram.ID, facId).Delete(&models.FacilitiesPrograms{}).Error; err != nil {
				return nil, newDeleteDBError(err, "facilities_programs")
			}
		}
	}

	return logEntries, nil
}

func updateProgramTypes(trans *gorm.DB, updateProgram *models.Program, programTypes []models.ProgramType) ([]models.ChangeLogEntry, error) {
	var (
		currentPrgTypes []models.ProgramType
		logEntries      []models.ChangeLogEntry
		progType        models.ProgType
	)
	if err := trans.Where("program_id = ?", updateProgram.ID).Find(&currentPrgTypes).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_types")
	}

	currentPrgTypesMap := make(map[models.ProgType]struct{}, len(currentPrgTypes)) //added light weight map used for lookup
	for _, pt := range currentPrgTypes {
		currentPrgTypesMap[pt.ProgramType] = struct{}{}
	}

	updatePrgTypesMap := make(map[models.ProgType]struct{}, len(programTypes)) //added light weight map used for lookup
	for _, pt := range programTypes {
		progType = pt.ProgramType
		updatePrgTypesMap[progType] = struct{}{}
		if _, ok := currentPrgTypesMap[progType]; !ok { //type doesn't exist create it
			logEntries = append(logEntries, *models.NewChangeLogEntry("programs", "program_type", nil, models.StringPtr(string(progType)), updateProgram.ID, updateProgram.UpdateUserID))
			if err := trans.Create(&models.ProgramType{
				ProgramID:   updateProgram.ID,
				ProgramType: progType,
			}).Error; err != nil {
				return nil, newCreateDBError(err, "program_types")
			}
		}
	}

	for prgType := range currentPrgTypesMap {
		if _, ok := updatePrgTypesMap[prgType]; !ok {
			logEntries = append(logEntries, *models.NewChangeLogEntry("programs", "program_type", models.StringPtr(string(prgType)), nil, updateProgram.ID, updateProgram.UpdateUserID))
			if err := trans.Where("program_id = ? and program_type = ?", updateProgram.ID, prgType).Delete(&models.ProgramType{}).Error; err != nil {
				return nil, newDeleteDBError(err, "program_types")
			}
		}
	}
	return logEntries, nil
}

func updateProgramCreditTypes(trans *gorm.DB, updateProgram *models.Program, programCreditTypes []models.ProgramCreditType) ([]models.ChangeLogEntry, error) {
	var (
		currentPrgCreditTypes []models.ProgramCreditType
		logEntries            []models.ChangeLogEntry
		progCreditType        models.CreditType
	)
	if err := trans.Where("program_id = ?", updateProgram.ID).Find(&currentPrgCreditTypes).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_credit_types")
	}

	currentPrgCreditTypesMap := make(map[models.CreditType]struct{}, len(currentPrgCreditTypes)) //added a light weight map used for lookup
	for _, ct := range currentPrgCreditTypes {
		currentPrgCreditTypesMap[ct.CreditType] = struct{}{}
	}

	updatePrgCreditTypesMap := make(map[models.CreditType]struct{}, len(programCreditTypes)) //added a light weight map used for lookup
	for _, pt := range programCreditTypes {
		progCreditType = pt.CreditType
		updatePrgCreditTypesMap[progCreditType] = struct{}{}
		if _, ok := currentPrgCreditTypesMap[progCreditType]; !ok { //type doesn't exist create it
			logEntries = append(logEntries, *models.NewChangeLogEntry("programs", "credit_type", nil, models.StringPtr(string(progCreditType)), updateProgram.ID, updateProgram.UpdateUserID))
			if err := trans.Create(&models.ProgramCreditType{
				ProgramID:  updateProgram.ID,
				CreditType: progCreditType,
			}).Error; err != nil {
				return nil, newCreateDBError(err, "program_credit_types")
			}
		}
	}

	for creditType := range currentPrgCreditTypesMap {
		if _, ok := updatePrgCreditTypesMap[creditType]; !ok { //type was removed delete it
			logEntries = append(logEntries, *models.NewChangeLogEntry("programs", "credit_type", models.StringPtr(string(creditType)), nil, updateProgram.ID, updateProgram.UpdateUserID))
			if err := trans.Where("program_id = ? and credit_type = ?", updateProgram.ID, creditType).Delete(&models.ProgramCreditType{}).Error; err != nil {
				return nil, newDeleteDBError(err, "program_credit_types")
			}
		}
	}
	return logEntries, nil
}

func (db *DB) UpdateProgramStatus(ctx context.Context, programUpdate map[string]any, id uint) ([]string, bool, error) {
	var (
		facilities []string
		logEntry   *models.ChangeLogEntry
	)
	updatePrg, err := db.GetProgramByID(int(id))
	if err != nil {
		return nil, false, err
	}
	if programUpdate["archived_at"] != nil {
		err := db.WithContext(ctx).Model(&models.ProgramClass{}).
			Joins("JOIN facilities ON facilities.id = program_classes.facility_id").
			Where("program_classes.program_id = ? AND program_classes.status IN ? AND program_classes.archived_at IS NULL", id,
				[]models.ClassStatus{models.Active, models.Scheduled}).
			Distinct().
			Pluck("facilities.name", &facilities).Error

		if err != nil {
			return nil, false, newGetRecordsDBError(err, "program_classes / facilities")
		}
		if len(facilities) > 0 {
			return facilities, false, nil
		}
		logEntry = models.NewChangeLogEntry("programs", "archived_at", nil, models.StringPtr(programUpdate["archived_at"].(string)), updatePrg.ID, programUpdate["update_user_id"].(uint))
	} else { //is possible that the old value is the same as the new value here when reactivating
		oldValue := strconv.FormatBool(updatePrg.IsActive)
		newValue := strconv.FormatBool(programUpdate["is_active"].(bool))
		logEntry = models.NewChangeLogEntry("programs", "is_active", models.StringPtr(oldValue), models.StringPtr(newValue), updatePrg.ID, programUpdate["update_user_id"].(uint))
	}
	trans := db.WithContext(ctx).Begin() //create transaction
	if trans.Error != nil {
		return nil, false, NewDBError(trans.Error, "unable to start the database transaction")
	}
	if err := trans.Model(&models.Program{}).
		Where("id = ?", id).
		Updates(programUpdate).Error; err != nil {
		return nil, false, newUpdateDBError(err, "program status")
	}
	if err := trans.Create(&logEntry).Error; err != nil {
		trans.Rollback()
		return nil, false, newCreateDBError(err, "change_log_entries")
	}
	if err := trans.Commit().Error; err != nil { //commit transaction
		return nil, false, NewDBError(err, "unable to commit the database transaction")
	}
	return facilities, true, nil
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
	var mostRecentDate time.Time
	if err := db.WithContext(args.Ctx).
		Model(&models.DailyProgramFacilityHistory{}).
		Select("MAX(date)").
		Where("facility_id = ?", args.FacilityID).
		Scan(&mostRecentDate).Error; err != nil {
		return programsFacilityStats, newGetRecordsDBError(err, "programs facilities stats (max date)")
	}
	var totals struct {
		TotalPrograms    int64 `json:"total_programs"`
		TotalEnrollments int64 `json:"total_enrollments"`
	}
	if err := db.WithContext(args.Ctx).
		Model(&models.DailyProgramFacilityHistory{}).
		Select(`
		COUNT(*) AS total_programs,
		SUM(total_enrollments) AS total_enrollments`).
		Where("facility_id = ? AND date = ?", args.FacilityID, mostRecentDate).
		Scan(&totals).Error; err != nil {
		return programsFacilityStats, newGetRecordsDBError(err, "programs facilities stats (totals for most recent date)")
	}
	tx := db.WithContext(args.Ctx).Model(&models.DailyProgramFacilityHistory{}).
		Select(`
		SUM(total_students_present) * 1.0 / NULLIF(SUM(total_attendances_marked), 0) * 100 AS attendance_rate,
		SUM(total_completions) * 1.0 / NULLIF(SUM(total_enrollments), 0) * 100 AS completion_rate
	`).Where("facility_id = ?", args.FacilityID)
	if timeFilter > 0 {
		tx = tx.Where("date >= ?", time.Now().AddDate(0, 0, -timeFilter))
	}
	if err := tx.Scan(&programsFacilityStats).Error; err != nil {
		return programsFacilityStats, newGetRecordsDBError(err, "programs facilities stats")
	}
	programsFacilityStats.TotalPrograms = &totals.TotalPrograms
	programsFacilityStats.TotalEnrollments = &totals.TotalEnrollments

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
			pt.program_types AS program_types,
			pct.credit_types AS credit_types,
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

	tx = tx.Joins(`LEFT JOIN (
				SELECT program_id, STRING_AGG(DISTINCT program_type::text, ',') AS program_types
				FROM program_types
				GROUP BY program_id
			  ) AS pt ON pt.program_id = programs.id
			`).Joins(`
			  LEFT JOIN (
				SELECT program_id, STRING_AGG(DISTINCT credit_type::text, ',') AS credit_types
				FROM program_credit_types
				GROUP BY program_id
			  ) AS pct ON pct.program_id = programs.id
			`).Group(totalActiveFacilitiesQuery + "programs.id, programs.name, mr.total_enrollments, mr.total_active_enrollments, mr.total_classes, programs.funding_type, pt.program_types, pct.credit_types")

	if adminRole == models.FacilityAdmin {
		tx = tx.Joins("JOIN facilities_programs fp ON fp.program_id = programs.id").Where("fp.facility_id = ?", args.FacilityID)
	}
	if !includeArchived {
		tx = tx.Where("programs.archived_at IS NULL")
	}
	if len(args.Tags) > 0 {
		tx = tx.Where("pt.program_id IN (?)", args.Tags)
	}
	if args.Search != "" {
		tx = tx.Where("LOWER(name) LIKE ? OR LOWER(description) LIKE ? ", args.SearchQuery(), args.SearchQuery())
	}
	if err := tx.Count(&args.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "programs table")
	}
	if args.OrderBy != "" && args.Order != "" {
		tx = tx.Order(args.OrderBy + " " + args.Order)
	} else {
		tx = tx.Order(args.OrderClause("programs.created_at desc"))
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

func (db *DB) GetProgramsCSVData(args *models.QueryContext) ([]models.ProgramCSVData, error) {
	var programCSVData []models.ProgramCSVData
	statuses := [5]models.ProgramEnrollmentStatus{
		models.EnrollmentCompleted,
		models.EnrollmentIncompleteWithdrawn,
		models.EnrollmentIncompleteDropped,
		models.EnrollmentIncompleteFailedToComplete,
		models.EnrollmentIncompleteTransfered,
	}
	tx := db.WithContext(args.Ctx).Table("programs p").
		Joins("JOIN program_classes pc ON pc.program_id = p.id").
		Joins("JOIN program_class_enrollments pe ON pe.class_id = pc.id").
		Joins("JOIN users u on u.id = pe.user_id").
		Joins("JOIN facilities f ON f.id = u.facility_id").
		Joins("LEFT JOIN program_completions c on c.program_class_id = pc.id and c.user_id = u.id").
		Joins("LEFT JOIN program_class_events pce on pce.class_id = pc.id").
		Joins("LEFT JOIN program_class_event_attendance pca ON pca.event_id = pce.id AND pca.user_id = u.id").
		Select(` 
	           f.name AS facility_name,
	           p.name AS program_name,
	           pc.name AS class_name,
			   u.id as unlock_ed_id,
	           u.doc_id AS resident_id,
				u.name_last AS name_last,
				u.name_first AS name_first,
	           pe.created_at as enrollment_date,
			   COALESCE(
	           CASE
	               WHEN c.id IS NOT NULL THEN c.created_at
	               WHEN pe.enrollment_status IN (?) THEN pe.updated_at
	               END, 
	               pc.end_dt
	 		) as end_date,
	           pe.enrollment_status AS end_status,
	           CASE 
	               WHEN COUNT(CASE WHEN pca.attendance_status IS NOT NULL AND pca.attendance_status != '' THEN 1 END) = 0 THEN 0
	               ELSE 
	                   COALESCE(
	                       SUM(CASE WHEN pca.attendance_status = 'present' THEN 1 ELSE 0 END) * 100.0 / 
	                       NULLIF(COUNT(CASE WHEN pca.attendance_status IS NOT NULL AND pca.attendance_status != '' THEN 1 END), 0),
	                       0
	                   )
	           END AS attendance_percentage`, statuses).
		Where(`
			(
				c.id IS NOT NULL 
				OR pe.enrollment_status IN (?)
			)
		`, statuses).
		Group("u.id, u.doc_id, f.name, p.name, pc.name, pe.created_at, pe.enrollment_status, pe.updated_at, c.id, c.created_at, pc.end_dt").
		Order("f.name ASC, p.name ASC, pc.name ASC, end_date DESC")

	if !args.All {
		tx = tx.Where("f.id = ?", args.FacilityID)
	}

	if err := tx.Scan(&programCSVData).Error; err != nil {
		return nil, newGetRecordsDBError(err, "programs CSV data")
	}
	return programCSVData, nil
}
