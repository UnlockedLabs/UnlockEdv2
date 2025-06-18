package database

import (
	"UnlockEdv2/src/models"
	"fmt"

	"golang.org/x/net/context"
	// "gorm.io/gorm"
)

func (db *DB) GetClassByID(id int) (*models.ProgramClass, error) {
	content := &models.ProgramClass{}
	if err := db.Preload("Events").Preload("Events.Overrides").Preload("Enrollments").Preload("Program").First(content, "id = ?", id).Error; err != nil {
		return nil, newNotFoundDBError(err, "program classes")
	}
	var enrollments int
	for _, enrolled := range content.Enrollments {
		if enrolled.EnrollmentStatus == models.Enrolled {
			enrollments += 1
		}
	}
	content.Enrolled = int64(enrollments)
	return content, nil
}

func (db *DB) GetClassesForFacility(args *models.QueryContext) ([]models.ProgramClass, error) {
	content := []models.ProgramClass{}
	tx := db.WithContext(args.Ctx).Find(&content, "facility_id = ?", args.FacilityID)
	if args.Search != "" {
		tx = tx.Where("LOWER(name) LIKE ?", args.SearchQuery())
	}
	if err := tx.Count(&args.Total).Limit(args.PerPage).Offset(args.CalcOffset()).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program classes")
	}
	return content, nil
}

func (db *DB) CreateProgramClass(content *models.ProgramClass) (*models.ProgramClass, error) {
	err := Validate().Struct(content)
	if err != nil {
		return nil, newCreateDBError(err, "create program classes validation error")
	}
	if err := db.Create(&content).Error; err != nil {
		return nil, newCreateDBError(err, "program classes")
	}
	return content, nil
}

func (db *DB) UpdateProgramClass(ctx context.Context, content *models.ProgramClass, id int) (*models.ProgramClass, error) {
	var allChanges []models.ChangeLogEntry
	existing := &models.ProgramClass{}
	if err := db.WithContext(ctx).Preload("Events").First(existing, "id = ?", id).Error; err != nil {
		return nil, newNotFoundDBError(err, "program classes")
	}

	trans := db.WithContext(ctx).Begin()
	if trans.Error != nil {
		return nil, NewDBError(trans.Error, "unable to start the database transaction")
	}

	ignoredFieldNames := []string{"create_user_id", "update_user_id", "enrollments", "facility", "facilities", "events", "facility_program", "program_id", "start_dt", "end_dt", "program", "enrolled"}
	classLogEntries := models.GenerateChangeLogEntries(existing, content, "program_classes", existing.ID, content.UpdateUserID, ignoredFieldNames)
	allChanges = append(allChanges, classLogEntries...)

	models.UpdateStruct(existing, content)
	if len(content.Events) > 0 {
		e := content.Events[0]
		if e.Room != "" {
			if err := trans.Model(&models.ProgramClassEvent{}).
				Where("id = ?", e.ID).
				Update("room", e.Room).Error; err != nil {
				trans.Rollback()
				return nil, newUpdateDBError(err, "program_class_events")
			}
		}
	}

	if err := trans.Omit("Events").Updates(existing).Error; err != nil {
		trans.Rollback()
		return nil, newUpdateDBError(err, "program classes")
	}

	if len(allChanges) > 0 {
		if err := trans.Create(&allChanges).Error; err != nil {
			trans.Rollback()
			return nil, newCreateDBError(err, "change_log_entries")
		}
	}

	if err := trans.Commit().Error; err != nil {
		return nil, NewDBError(err, "unable to commit the database transaction")
	}
	return existing, nil
}

func (db *DB) GetTotalEnrollmentsByClassID(id int) (int64, error) {
	var count int64
	if err := db.Model(&models.ProgramClassEnrollment{}).Where("class_id = ? and enrollment_status = 'Enrolled'", id).Count(&count).Error; err != nil {
		return 0, NewDBError(err, "program_class_enrollments")
	}
	return count, nil
}

func (db *DB) GetProgramClassDetailsByID(id int, args *models.QueryContext) ([]models.ProgramClassDetail, error) {
	var classDetails []models.ProgramClassDetail
	query := db.WithContext(args.Ctx).Table("program_classes ps").
		Select(`ps.*,
		fac.name as facility_name,
		count(pse.id) as enrolled
		`).
		Joins(`join facilities fac on fac.id = ps.facility_id
			AND fac.deleted_at IS NULL`).
		Joins(`left outer join program_class_enrollments pse on pse.class_id = ps.id 
			and enrollment_status = 'Enrolled'`). //TODO Enrolled may change here
		Where(`ps.program_id = ? 
			and ps.facility_id = ?`, id, args.FacilityID).
		Group("ps.id,fac.name")
	if err := query.Count(&args.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "programs")
	}
	if err := query.Limit(args.PerPage).Offset(args.CalcOffset()).Order(args.OrderClause("ps.created_at desc")).Find(&classDetails).Error; err != nil {
		return nil, newGetRecordsDBError(err, "programs")
	}

	classIDs := make([]uint, 0, len(classDetails))
	for _, detail := range classDetails { //gathering all for next query
		classIDs = append(classIDs, detail.ID)
	}
	events := []models.ProgramClassEvent{}
	if err := db.Model(&models.ProgramClassEvent{}).Preload("Overrides").Where("class_id IN (?)", classIDs).Find(&events).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_events")
	}
	eventMap := make(map[uint][]models.ProgramClassEvent)
	for _, event := range events {
		eventMap[event.ClassID] = append(eventMap[event.ClassID], event)
	}
	for i, j := 0, len(classDetails); i < j; i++ {
		classDetails[i].Events = eventMap[classDetails[i].ID]
	}

	return classDetails, nil
}

type ProgramClassOutcomes struct {
	Month       string `json:"month"`
	Drops       int    `json:"drops"`
	Completions int    `json:"completions"`
}

func (db *DB) GetProgramClassOutcomes(id int, args *models.QueryContext) ([]ProgramClassOutcomes, error) {
	var outcomes []ProgramClassOutcomes

	facilityID := args.FacilityID
	incompleteStatuses := []models.ProgramEnrollmentStatus{
		models.EnrollmentIncompleteDropped,
		models.EnrollmentIncompleteFailedToComplete,
		models.EnrollmentIncompleteTransfered}

	// Create a set that includes the last 6 months, excluding the current month, of program outcomes
	const lastSixMonthsSubquery = `(SELECT TO_CHAR(
		DATE_TRUNC('month', NOW()) - INTERVAL '1 month' * gs.i, 'YYYY-MM') AS month 
		FROM generate_series(1, 6) AS gs(i))`

	enrollmentsSubquery := `(SELECT * 
		FROM program_class_enrollments 
		WHERE class_id IN (
			SELECT id FROM program_classes 
			WHERE program_id = ? AND facility_id = ?
		))`

	query := db.WithContext(args.Ctx).
		Table(fmt.Sprintf("(%s) AS months", lastSixMonthsSubquery)).
		Select(`
			months.month,
			COALESCE(
          COUNT(CASE WHEN pce.enrollment_status = ? THEN pce.class_id END), 0) AS completions,
        	COALESCE(COUNT(CASE WHEN pce.enrollment_status IN (?) THEN pce.class_id END),0) AS drops
		`, models.EnrollmentCompleted, incompleteStatuses).
		Joins(fmt.Sprintf(`
			LEFT JOIN (%s) AS pce 
			ON TO_CHAR(DATE_TRUNC('month', pce.updated_at), 'YYYY-MM') = months.month
		`, enrollmentsSubquery), id, facilityID).
		Group("months.month").
		Order(args.OrderBy)
	if err := query.Find(&outcomes).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_enrollments")
	}
	return outcomes, nil
}

func (db *DB) GetProgramClassesHistory(id int, tableName string, args *models.QueryContext) ([]models.ProgramClassesHistory, error) {
	history := []models.ProgramClassesHistory{}
	if err := db.WithContext(args.Ctx).Order(args.OrderClause("created_at desc")).
		Find(&history, "parent_ref_id = ? and table_name = ?", id, tableName).
		Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_classes_history")
	}
	return history, nil
}

func (db *DB) GetClassCreatedAtAndBy(id int, args *models.QueryContext) (models.ActivityHistoryResponse, error) {
	var classDetails models.ActivityHistoryResponse
	if err := db.WithContext(args.Ctx).Table("program_classes ps").
		Select("ps.created_at, u.username as admin_username").
		Joins("join users u on u.id = ps.create_user_id").
		Where("ps.id = ?", id).
		Scan(&classDetails).Error; err != nil {
		return classDetails, newNotFoundDBError(err, "program_classes")
	}
	return classDetails, nil
}
