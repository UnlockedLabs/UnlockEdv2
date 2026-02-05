package database

import (
	"UnlockEdv2/src/models"
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

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
		COUNT(CASE WHEN pce.enrollment_status = 'Enrolled' AND pce.enrolled_at IS NOT NULL AND (pce.enrollment_ended_at IS NULL OR pce.enrollment_ended_at > CURRENT_TIMESTAMP) THEN 1 END) AS active_enrollments,
		COUNT(CASE WHEN pce.enrollment_status = 'Completed' THEN 1 END) AS completions,
		COUNT(CASE WHEN pce.enrolled_at IS NOT NULL THEN 1 END) AS total_enrollments,
		COUNT(DISTINCT CASE WHEN pce.enrollment_status = 'Enrolled' AND pce.enrolled_at IS NOT NULL AND (pce.enrollment_ended_at IS NULL OR pce.enrollment_ended_at > CURRENT_TIMESTAMP) THEN pce.user_id END) as active_residents,
		CASE
			WHEN COUNT(CASE WHEN pce.enrolled_at IS NOT NULL THEN 1 END) = 0 THEN 0
			WHEN COUNT(CASE WHEN pce.enrollment_status = 'Enrolled' AND pce.enrolled_at IS NOT NULL AND (pce.enrollment_ended_at IS NULL OR pce.enrollment_ended_at > CURRENT_TIMESTAMP) THEN 1 END) = 0
				AND COUNT(CASE WHEN pce.enrollment_status = 'Completed' THEN 1 END) = COUNT(CASE WHEN pce.enrolled_at IS NOT NULL THEN 1 END)
			THEN 100
			ELSE COUNT(CASE WHEN pce.enrollment_status = 'Completed' THEN 1 END) * 1.0 / COUNT(CASE WHEN pce.enrolled_at IS NOT NULL THEN 1 END) * 100
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

func (db *DB) GetProgramActiveClassFacilities(ctx context.Context, id uint) ([]string, error) {
	var facilities []string
	if err := db.WithContext(ctx).Table("program_classes").
		Joins("JOIN facilities ON facilities.id = program_classes.facility_id").
		Where("program_classes.program_id = ? AND program_classes.status IN (?, ?) AND program_classes.archived_at IS NULL", id,
			models.Active, models.Scheduled).
		Distinct().
		Pluck("facilities.name", &facilities).Error; err != nil {
		return nil, newGetRecordsDBError(err, fmt.Sprintf("program %d active facilities", id))
	}
	return facilities, nil
}

func (db *DB) GetPrograms(args *models.QueryContext) ([]models.Program, error) {
	content := make([]models.Program, 0, args.PerPage)
	tx := db.WithContext(args.Ctx).Model(&models.Program{}).
		Preload("ProgramTypes").
		Preload("ProgramCreditTypes").
		Joins("JOIN facilities_programs fp ON fp.program_id = programs.id").
		Where("fp.facility_id = ?", args.FacilityID)
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
	return content, nil
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

func (db *DB) UpdateProgram(program *models.Program, facilityIds []int) (*models.Program, error) {
	var allChanges []models.ChangeLogEntry
	updatePrg, err := db.GetProgramByID(int(program.ID))
	if err != nil {
		return nil, err
	}
	//begin the transaction
	trans := db.Begin() //only need to pass context here, it will be used/shared within the transaction
	if trans.Error != nil {
		return nil, NewDBError(trans.Error, "unable to start the database transaction")
	}
	ignoredFieldNames := []string{"create_user_id", "update_user_id", "program_types", "credit_types", "facilities", "archived_at"}
	programLogEntries := models.GenerateChangeLogEntries(updatePrg, program, "programs", updatePrg.ID, models.DerefUint(program.UpdateUserID), ignoredFieldNames)
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
		trans.Rollback()
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
			logEntries = append(logEntries, *models.NewChangeLogEntry("programs", "facility_id", nil, models.StringPtr(strconv.Itoa(int(facilityID))), updateProgram.ID, models.DerefUint(updateProgram.UpdateUserID)))
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
			logEntries = append(logEntries, *models.NewChangeLogEntry("programs", "facility_id", models.StringPtr(strconv.Itoa(int(facId))), nil, updateProgram.ID, models.DerefUint(updateProgram.UpdateUserID)))
			now := time.Now().UTC()
			updates := map[string]any{
				"update_user_id": models.DerefUint(updateProgram.UpdateUserID),
				"deleted_at":     gorm.DeletedAt{Time: now, Valid: true},
			}
			if err := trans.Model(&models.FacilitiesPrograms{}).
				Where("program_id = ? and facility_id = ?", updateProgram.ID, facId).
				Updates(updates).Error; err != nil {
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
			logEntries = append(logEntries, *models.NewChangeLogEntry("programs", "program_type", nil, models.StringPtr(string(progType)), updateProgram.ID, models.DerefUint(updateProgram.UpdateUserID)))
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
			logEntries = append(logEntries, *models.NewChangeLogEntry("programs", "program_type", models.StringPtr(string(prgType)), nil, updateProgram.ID, models.DerefUint(updateProgram.UpdateUserID)))
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
			logEntries = append(logEntries, *models.NewChangeLogEntry("programs", "credit_type", nil, models.StringPtr(string(progCreditType)), updateProgram.ID, models.DerefUint(updateProgram.UpdateUserID)))
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
			logEntries = append(logEntries, *models.NewChangeLogEntry("programs", "credit_type", models.StringPtr(string(creditType)), nil, updateProgram.ID, models.DerefUint(updateProgram.UpdateUserID)))
			if err := trans.Where("program_id = ? and credit_type = ?", updateProgram.ID, creditType).Delete(&models.ProgramCreditType{}).Error; err != nil {
				return nil, newDeleteDBError(err, "program_credit_types")
			}
		}
	}
	return logEntries, nil
}

func (db *DB) UpdateProgramStatus(programUpdate map[string]any, id uint) ([]string, bool, error) {
	var (
		facilities []string
		logEntry   *models.ChangeLogEntry
	)
	updatePrg, err := db.GetProgramByID(int(id))
	if err != nil {
		return nil, false, err
	}
	if programUpdate["archived_at"] != nil {
		err := db.Model(&models.ProgramClass{}).
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
	trans := db.Begin() //create transaction
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

	if err := db.WithContext(args.Ctx).Model(&models.Program{}).
		Select("COUNT(*) AS total_programs").
		Where("is_active = true AND archived_at IS NULL").
		Scan(&totals.TotalPrograms).Error; err != nil {
		return programsFacilitiesStats, newGetRecordsDBError(err, "total active programs")
	}

	if err := db.WithContext(args.Ctx).Model(&models.ProgramClassEnrollment{}).
		Select("COUNT(CASE WHEN enrolled_at IS NOT NULL THEN 1 END) AS total_enrollments").
		Scan(&totals.TotalEnrollments).Error; err != nil {
		return programsFacilitiesStats, newGetRecordsDBError(err, "total enrollments")
	}

	var rateStats struct {
		AvgActiveProgramsPerFacility float64 `json:"avg_active_programs_per_facility"`
		AttendanceRate               float64 `json:"attendance_rate"`
		CompletionRate               float64 `json:"completion_rate"`
	}

	completionTimeFilter := ""
	attendanceTimeFilter := ""
	if timeFilter > 0 {
		cutoffDate := time.Now().AddDate(0, 0, -timeFilter).Format("2006-01-02")
		completionTimeFilter = fmt.Sprintf("AND (pce.enrollment_ended_at >= '%s' OR pcev.created_at >= '%s')", cutoffDate, cutoffDate)
		attendanceTimeFilter = completionTimeFilter
	}

	partialAttendanceSQL := buildPartialAttendanceSQL(db.Name(), "pcea")
	var avgResult struct {
		TotalAssociations int64 `json:"total_associations"`
		TotalFacilities   int64 `json:"total_facilities"`
	}

	if err := db.WithContext(args.Ctx).Raw(`
		SELECT
			COUNT(DISTINCT fp.id) as total_associations,
			COUNT(DISTINCT f.id) as total_facilities
		FROM facilities f
		LEFT JOIN facilities_programs fp ON fp.facility_id = f.id
		LEFT JOIN programs p ON p.id = fp.program_id AND p.is_active = true AND p.archived_at IS NULL
		LEFT JOIN program_classes pc ON pc.program_id = p.id AND pc.facility_id = f.id AND pc.status = 'Active'
		LEFT JOIN program_class_enrollments pce ON pce.class_id = pc.id
		WHERE pc.id IS NOT NULL AND pce.id IS NOT NULL AND pce.enrolled_at IS NOT NULL AND (pce.enrollment_ended_at IS NULL OR pce.enrollment_ended_at > CURRENT_TIMESTAMP)
	`).Scan(&avgResult).Error; err != nil {
		return programsFacilitiesStats, newGetRecordsDBError(err, "avg active programs per facility")
	}

	if avgResult.TotalFacilities > 0 {
		rateStats.AvgActiveProgramsPerFacility = float64(avgResult.TotalAssociations) / float64(avgResult.TotalFacilities)
	} else {
		rateStats.AvgActiveProgramsPerFacility = 0
	}

	query := fmt.Sprintf(`
		SELECT
			COALESCE(COUNT(CASE WHEN pce.enrollment_status = 'Completed' AND pce.enrolled_at IS NOT NULL %s THEN 1 END) * 100.0 /
				NULLIF(COUNT(CASE WHEN pce.enrolled_at IS NOT NULL THEN 1 END), 0), 0) AS completion_rate,
			COALESCE(SUM(
				CASE
					WHEN pcea.attendance_status = 'present' %s THEN 1
					WHEN pcea.attendance_status = 'partial' %s THEN %s
					ELSE 0
					END
				) * 100.0 /
					NULLIF(COUNT(CASE WHEN pcea.attendance_status IS NOT NULL AND pcea.attendance_status != '' %s THEN 1 END), 0), 0) AS attendance_rate
		FROM program_class_enrollments pce
		LEFT JOIN program_classes pc ON pc.id = pce.class_id
		LEFT JOIN program_class_events pcev ON pcev.class_id = pc.id
		LEFT JOIN program_class_event_attendance pcea ON pcea.event_id = pcev.id AND pcea.user_id = pce.user_id
		WHERE pce.enrolled_at IS NOT NULL %s
	`, completionTimeFilter, attendanceTimeFilter, attendanceTimeFilter, partialAttendanceSQL, attendanceTimeFilter, completionTimeFilter)

	var completionAttendanceRates struct {
		AttendanceRate float64 `json:"attendance_rate"`
		CompletionRate float64 `json:"completion_rate"`
	}

	if err := db.WithContext(args.Ctx).Raw(query).Scan(&completionAttendanceRates).Error; err != nil {
		return programsFacilitiesStats, newGetRecordsDBError(err, "completion and attendance rates")
	}

	rateStats.AttendanceRate = completionAttendanceRates.AttendanceRate
	rateStats.CompletionRate = completionAttendanceRates.CompletionRate

	programsFacilitiesStats.TotalPrograms = &totals.TotalPrograms
	programsFacilitiesStats.TotalEnrollments = &totals.TotalEnrollments
	programsFacilitiesStats.AvgActiveProgramsPerFacility = &rateStats.AvgActiveProgramsPerFacility
	programsFacilitiesStats.AttendanceRate = &rateStats.AttendanceRate
	programsFacilitiesStats.CompletionRate = &rateStats.CompletionRate

	return programsFacilitiesStats, nil
}

func (db *DB) GetProgramsFacilityStats(args *models.QueryContext, timeFilter int) (models.ProgramsFacilitiesStats, error) {
	var programsFacilityStats models.ProgramsFacilitiesStats

	var totals struct {
		TotalPrograms    int64 `json:"total_programs"`
		TotalEnrollments int64 `json:"total_enrollments"`
	}

	if err := db.WithContext(args.Ctx).Raw(`
		SELECT COUNT(DISTINCT p.id) AS total_programs
		FROM programs p
		JOIN facilities_programs fp ON fp.program_id = p.id
		JOIN program_classes pc ON pc.program_id = p.id AND pc.facility_id = fp.facility_id AND pc.status = 'Active'
		JOIN program_class_enrollments pce ON pce.class_id = pc.id
		WHERE fp.facility_id = ? AND p.is_active = true AND p.archived_at IS NULL
	`, args.FacilityID).Scan(&totals.TotalPrograms).Error; err != nil {
		return programsFacilityStats, newGetRecordsDBError(err, "total programs for facility")
	}

	if err := db.WithContext(args.Ctx).
		Model(&models.ProgramClassEnrollment{}).
		Select("COUNT(CASE WHEN program_class_enrollments.enrolled_at IS NOT NULL THEN 1 END) AS total_enrollments").
		Joins("LEFT JOIN program_classes pc ON pc.id = program_class_enrollments.class_id").
		Where("pc.facility_id = ?", args.FacilityID).
		Scan(&totals.TotalEnrollments).Error; err != nil {
		return programsFacilityStats, newGetRecordsDBError(err, "total enrollments for facility")
	}

	var rateStats struct {
		AvgActiveProgramsPerFacility float64 `json:"avg_active_programs_per_facility"`
		AttendanceRate               float64 `json:"attendance_rate"`
		CompletionRate               float64 `json:"completion_rate"`
	}

	completionTimeFilter := ""
	attendanceTimeFilter := ""
	if timeFilter > 0 {
		cutoffDate := time.Now().AddDate(0, 0, -timeFilter).Format("2006-01-02")
		completionTimeFilter = fmt.Sprintf("AND (pce.enrollment_ended_at >= '%s' OR pcev.created_at >= '%s')", cutoffDate, cutoffDate)
		attendanceTimeFilter = completionTimeFilter
	}

	partialAttendanceSQL := buildPartialAttendanceSQL(db.Name(), "pcea")
	query := fmt.Sprintf(`
		SELECT
			COALESCE(COUNT(CASE WHEN pce.enrollment_status = 'Completed' AND pce.enrolled_at IS NOT NULL %s THEN 1 END) * 100.0 /
				NULLIF(COUNT(CASE WHEN pce.enrolled_at IS NOT NULL THEN 1 END), 0), 0) AS completion_rate,
			COALESCE(SUM(
				CASE
					WHEN pcea.attendance_status = 'present' %s THEN 1
					WHEN pcea.attendance_status = 'partial' %s THEN %s
					ELSE 0
					END
				) * 100.0 /
					NULLIF(COUNT(CASE WHEN pcea.attendance_status IS NOT NULL AND pcea.attendance_status != '' %s THEN 1 END), 0), 0) AS attendance_rate
		FROM program_class_enrollments pce
		LEFT JOIN program_classes pc ON pc.id = pce.class_id
		LEFT JOIN program_class_events pcev ON pcev.class_id = pc.id
		LEFT JOIN program_class_event_attendance pcea ON pcea.event_id = pcev.id AND pcea.user_id = pce.user_id
		WHERE pc.facility_id = ? AND pce.enrolled_at IS NOT NULL %s
	`, completionTimeFilter, attendanceTimeFilter, attendanceTimeFilter, partialAttendanceSQL, attendanceTimeFilter, completionTimeFilter)

	if err := db.WithContext(args.Ctx).Raw(query, args.FacilityID).Scan(&rateStats).Error; err != nil {
		return programsFacilityStats, newGetRecordsDBError(err, "facility completion and attendance rates")
	}

	rateStats.AvgActiveProgramsPerFacility = float64(totals.TotalPrograms)

	programsFacilityStats.TotalPrograms = &totals.TotalPrograms
	programsFacilityStats.TotalEnrollments = &totals.TotalEnrollments
	programsFacilityStats.AvgActiveProgramsPerFacility = &rateStats.AvgActiveProgramsPerFacility
	programsFacilityStats.AttendanceRate = &rateStats.AttendanceRate
	programsFacilityStats.CompletionRate = &rateStats.CompletionRate

	return programsFacilityStats, nil
}

func parseOperatorAndValue(input string) (string, float64) {
	ops := []string{">=", "<=", "!=", "=", ">", "<"}
	for _, op := range ops {
		if strings.HasPrefix(input, op) {
			numString := strings.TrimSpace(input[len(op):])
			num, err := strconv.ParseFloat(numString, 64)
			if err == nil {
				return op, num
			}
			break
		}
	}
	return "", 0
}

func applyRateFilter(tx *gorm.DB, rateExpr string, val string) *gorm.DB {
	const floatTolerance = 0.005
	op, num := parseOperatorAndValue(val)
	switch op {
	case "!=":
		return tx.Where("ABS("+rateExpr+" - ?) > ?", num, floatTolerance)
	case "=":
		return tx.Where(rateExpr+" BETWEEN ? AND ?", num-floatTolerance, num+floatTolerance)
	case ">=":
		return tx.Where(rateExpr+" >= ?", num-floatTolerance)
	case "<=":
		return tx.Where(rateExpr+" <= ?", num+floatTolerance)
	case ">":
		return tx.Where(rateExpr+" > ?", num)
	case "<":
		return tx.Where(rateExpr+" < ?", num)
	}
	return tx
}

func (db *DB) GetProgramsOverviewTable(args *models.QueryContext, timeFilter int, includeArchived bool, adminRole models.UserRole, filters map[string]string) ([]models.ProgramsOverviewTable, error) {
	var programsTable []models.ProgramsOverviewTable

	baseQuery := db.WithContext(args.Ctx).Model(&models.Program{})

	var selectFields string
	if adminRole == models.FacilityAdmin {
		selectFields = `
			programs.id AS program_id,
			programs.name AS program_name,
			programs.archived_at AS archived_at,
			mr.total_enrollments AS total_enrollments,
			mr.total_active_enrollments AS total_active_enrollments,
			mr.total_classes AS total_classes,
			time_filtered_rates.completion_rate AS completion_rate,
			time_filtered_rates.attendance_rate AS attendance_rate,
			pt.program_types AS program_types,
			pct.credit_types AS credit_types,
			programs.funding_type AS funding_type,
			programs.is_active AS status
		`
	} else {
		selectFields = `
			programs.id AS program_id,
			programs.name AS program_name,
			programs.archived_at AS archived_at,
			mr.total_active_facilities AS total_active_facilities,
			mr.total_enrollments AS total_enrollments,
			mr.total_active_enrollments AS total_active_enrollments,
			mr.total_classes AS total_classes,
			time_filtered_rates.completion_rate AS completion_rate,
			time_filtered_rates.attendance_rate AS attendance_rate,
			pt.program_types AS program_types,
			pct.credit_types AS credit_types,
			programs.funding_type AS funding_type,
			programs.is_active AS status
		`
	}

	var currentMetricsSubquery string
	if adminRole == models.FacilityAdmin {
		currentMetricsSubquery = fmt.Sprintf(`
			LEFT JOIN (
				SELECT
					p.id as program_id,
					COUNT(DISTINCT pce.id) AS total_enrollments,
					COUNT(DISTINCT CASE WHEN pce.enrollment_status = 'Enrolled' AND pce.enrolled_at IS NOT NULL AND (pce.enrollment_ended_at IS NULL OR pce.enrollment_ended_at > CURRENT_TIMESTAMP) THEN pce.id END) AS total_active_enrollments,
					COUNT(DISTINCT CASE WHEN pc.status != 'Cancelled' THEN pc.id END) AS total_classes
				FROM programs p
				JOIN facilities_programs fp ON fp.program_id = p.id
				LEFT JOIN program_classes pc ON pc.program_id = p.id AND pc.facility_id = %d
				LEFT JOIN program_class_enrollments pce ON pce.class_id = pc.id
				WHERE fp.facility_id = %d
				GROUP BY p.id
			) AS mr ON mr.program_id = programs.id
		`, args.FacilityID, args.FacilityID)
	} else {
		currentMetricsSubquery = `
			LEFT JOIN (
				SELECT
					p.id as program_id,
					COUNT(DISTINCT CASE WHEN p.is_active = true AND p.archived_at IS NULL THEN fp.facility_id END) AS total_active_facilities,
					COUNT(DISTINCT pce.id) AS total_enrollments,
					COUNT(DISTINCT CASE WHEN pce.enrollment_status = 'Enrolled' AND pce.enrolled_at IS NOT NULL AND (pce.enrollment_ended_at IS NULL OR pce.enrollment_ended_at > CURRENT_TIMESTAMP) THEN pce.id END) AS total_active_enrollments,
					COUNT(DISTINCT CASE WHEN pc.status != 'Cancelled' THEN pc.id END) AS total_classes
				FROM programs p
				LEFT JOIN facilities_programs fp ON fp.program_id = p.id
				LEFT JOIN program_classes pc ON pc.program_id = p.id
				LEFT JOIN program_class_enrollments pce ON pce.class_id = pc.id
				GROUP BY p.id
			) AS mr ON mr.program_id = programs.id
		`
	}

	timeFilterCondition := ""
	if timeFilter > 0 {
		cutoffDate := time.Now().AddDate(0, 0, -timeFilter)
		timeFilterCondition = fmt.Sprintf(`
			AND (pce.enrollment_ended_at >= '%s' OR pcev.created_at >= '%s')
		`, cutoffDate.Format("2006-01-02"), cutoffDate.Format("2006-01-02"))
	}

	var facilityFilterForRates string
	if adminRole == models.FacilityAdmin {
		facilityFilterForRates = fmt.Sprintf("AND pc.facility_id = %d", args.FacilityID)
	}

	partialAttendanceSQL := buildPartialAttendanceSQL(db.Name(), "pcea")
	timeFilteredRatesSubquery := `
		LEFT JOIN (
			SELECT
				p.id as program_id,
				COALESCE(COUNT(CASE WHEN pce.enrollment_status = 'Completed' AND pce.enrollment_ended_at IS NOT NULL ` + timeFilterCondition + ` THEN 1 END) * 100.0 /
					NULLIF(COUNT(pce.id), 0), 0) AS completion_rate,
				COALESCE(SUM(
					CASE
						WHEN pcea.attendance_status = 'present' ` + timeFilterCondition + ` THEN 1
						WHEN pcea.attendance_status = 'partial' ` + timeFilterCondition + ` THEN ` + partialAttendanceSQL + `
						ELSE 0
					END
				) * 100.0 /
					NULLIF(COUNT(CASE WHEN pcea.attendance_status IS NOT NULL AND pcea.attendance_status != '' ` + timeFilterCondition + ` THEN 1 END), 0), 0) AS attendance_rate
			FROM programs p
			LEFT JOIN program_classes pc ON pc.program_id = p.id ` + facilityFilterForRates + `
			LEFT JOIN program_class_enrollments pce ON pce.class_id = pc.id
			LEFT JOIN program_class_events pcev ON pcev.class_id = pc.id
			LEFT JOIN program_class_event_attendance pcea ON pcea.event_id = pcev.id AND pcea.user_id = pce.user_id
			WHERE 1=1 ` + timeFilterCondition + `
			GROUP BY p.id
		) AS time_filtered_rates ON time_filtered_rates.program_id = programs.id
	`

	tx := baseQuery.Select(selectFields).
		Joins(currentMetricsSubquery).
		Joins(timeFilteredRatesSubquery).
		Joins(`LEFT JOIN (
			SELECT program_id, STRING_AGG(DISTINCT program_type::text, ',') AS program_types
			FROM program_types
			GROUP BY program_id
		) AS pt ON pt.program_id = programs.id`).
		Joins(`LEFT JOIN (
			SELECT program_id, STRING_AGG(DISTINCT credit_type::text, ',') AS credit_types
			FROM program_credit_types
			GROUP BY program_id
		) AS pct ON pct.program_id = programs.id`)

	if adminRole == models.FacilityAdmin {
		tx = tx.Joins("JOIN facilities_programs fp ON fp.program_id = programs.id").Where("fp.facility_id = ?", args.FacilityID)
	}

	if !includeArchived {
		tx = tx.Where("programs.archived_at IS NULL")
	}

	if len(args.Tags) > 0 {
		tx = tx.Where("programs.id IN (SELECT program_id FROM program_types WHERE program_type IN (?))", args.Tags)
	}

	for col, val := range filters {
		switch col {
		case "programs.name":
			tx = tx.Where("programs.name ILIKE ?", "%"+val+"%")
		case "mr.total_enrollments":
			op, num := parseOperatorAndValue(val)
			tx = tx.Where(fmt.Sprintf("mr.total_enrollments %s ?", op), num)
		case "mr.total_active_enrollments":
			op, num := parseOperatorAndValue(val)
			tx = tx.Where(fmt.Sprintf("mr.total_active_enrollments %s ?", op), num)
		case "mr.total_classes":
			op, num := parseOperatorAndValue(val)
			tx = tx.Where(fmt.Sprintf("mr.total_classes %s ?", op), num)
		case "mr.total_active_facilities":
			if adminRole != models.FacilityAdmin {
				op, num := parseOperatorAndValue(val)
				tx = tx.Where(fmt.Sprintf("mr.total_active_facilities %s ?", op), num)
			}
		case "completion_rate":
			tx = applyRateFilter(tx, "time_filtered_rates.completion_rate", val)
		case "attendance_rate":
			tx = applyRateFilter(tx, "time_filtered_rates.attendance_rate", val)
		case "pt.program_types":
			tx = tx.Where("pt.program_types ~* ?", val)
		case "pct.credit_types":
			tx = tx.Where("pct.credit_types ~* ?", val)
		case "programs.funding_type":
			tx = tx.Where("programs.funding_type IN (?)", strings.Split(val, "|"))
		case "programs.is_active":
			statuses := strings.Split(val, "|")
			conditions := make([]string, 0, len(statuses))
			for _, status := range statuses {
				switch status {
				case "Available":
					conditions = append(conditions, "programs.is_active = true")
				case "Archived":
					conditions = append(conditions, "programs.archived_at IS NOT NULL")
				case "Inactive":
					conditions = append(conditions, "programs.is_active = false")
				}
			}
			if len(conditions) > 0 {
				whereStatement := "(" + strings.Join(conditions, " OR ") + ")"
				tx = tx.Where(whereStatement)
			}
		case "facility_id":
			tx = tx.Joins("JOIN facilities_programs fp ON fp.program_id = programs.id").Where("fp.facility_id = ?", val)
		}
	}

	if args.Search != "" {
		tx = tx.Where("LOWER(programs.name) LIKE ? OR LOWER(programs.description) LIKE ?", args.SearchQuery(), args.SearchQuery())
	}

	if err := tx.Count(&args.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "programs table count")
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

	partialAttendanceSQL := buildPartialAttendanceSQL(db.Name(), "pca")
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
		       pc.instructor_name AS instructor_name,
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
	                       SUM(
							   CASE
								   WHEN pca.attendance_status = 'present' THEN 1
								   WHEN pca.attendance_status = 'partial' THEN `+partialAttendanceSQL+`
								   ELSE 0
							   END
						   ) * 100.0 /
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
		Group("u.id, u.doc_id, f.name, p.name, pc.name,pc.instructor_name, pe.created_at, pe.enrollment_status, pe.updated_at, c.id, c.created_at, pc.end_dt").
		Order("f.name ASC, p.name ASC, pc.name ASC, end_date DESC")

	if !args.All {
		tx = tx.Where("f.id = ?", args.FacilityID)
	}

	if err := tx.Scan(&programCSVData).Error; err != nil {
		return nil, newGetRecordsDBError(err, "programs CSV data")
	}
	return programCSVData, nil
}

func buildPartialAttendanceSQL(dialect, alias string) string {
	minutesCast := "COALESCE(%s.minutes_attended, %s.scheduled_minutes, 0)::numeric"
	if dialect == "sqlite" {
		minutesCast = "CAST(COALESCE(%s.minutes_attended, %s.scheduled_minutes, 0) AS REAL)"
	}
	minutesCast = fmt.Sprintf(minutesCast, alias, alias)
	ratioExpr := fmt.Sprintf("%s / NULLIF(COALESCE(%s.scheduled_minutes, %s.minutes_attended, 0), 0)", minutesCast, alias, alias)
	partialAttendanceSQL := fmt.Sprintf("CASE WHEN %s < 1 THEN %s ELSE 1 END", ratioExpr, ratioExpr)
	return partialAttendanceSQL
}
