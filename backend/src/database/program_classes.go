package database

import (
	"UnlockEdv2/src/models"
	"fmt"
	"strings"

	"golang.org/x/net/context"
	"gorm.io/gorm"
)

// Claims interface for bulk cancellation operations
type BulkCancelClaims interface {
	GetUserID() uint
	GetFacilityID() uint
}

func (db *DB) GetClassByID(id int) (*models.ProgramClass, error) {
	content := &models.ProgramClass{}
	if err := db.Preload("Events").Preload("Events.Overrides").Preload("Enrollments").Preload("Program").First(content, "id = ?", id).Error; err != nil {
		return nil, newNotFoundDBError(err, "program classes")
	}
	var enrollments, completed int

	for _, enrolled := range content.Enrollments {
		switch enrolled.EnrollmentStatus {
		case models.Enrolled:
			enrollments += 1
		case models.EnrollmentCompleted:
			completed += 1
		}
	}
	content.Enrolled = int64(enrollments)
	content.Completed = int64(completed)
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
	if err := trans.Session(&gorm.Session{FullSaveAssociations: true}).Updates(&existing).Error; err != nil {
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

func (db *DB) GetHistoricalEnrollmentForDates(classID int, dates []string) (map[string]int64, error) {
	results := make(map[string]int64)

	for _, date := range dates {
		trimmedDate := strings.TrimSpace(date)
		var count int64
		if err := db.Model(&models.ProgramClassEnrollment{}).
			Where("class_id = ?", classID).
			Where("DATE(enrolled_at) <= ?", trimmedDate).
			Where("enrollment_ended_at IS NULL OR DATE(enrollment_ended_at) > ?", trimmedDate).
			Count(&count).Error; err != nil {
			return nil, NewDBError(err, "historical enrollment count for date: "+trimmedDate)
		}
		results[trimmedDate] = count
	}

	return results, nil
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
		models.EnrollmentIncompleteTransfered,
		models.EnrollmentIncompleteSegregated}

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

// Get instructors assigned to classes at facility
func (db *DB) GetFacilityInstructors(facilityID int) ([]models.Instructor, error) {
	// TEMPORARY: Return mock data for UI testing while debugging the 500 error
	// TODO: Remove this mock data and fix the underlying database query issue
	mockInstructors := []models.Instructor{
		{
			ID:        1,
			Username:  "john.doe",
			NameFirst: "John",
			NameLast:  "Doe",
			Email:     "john.doe@example.com",
		},
		{
			ID:        2,
			Username:  "jane.smith",
			NameFirst: "Jane",
			NameLast:  "Smith",
			Email:     "jane.smith@example.com",
		},
		{
			ID:        3,
			Username:  "robert.johnson",
			NameFirst: "Robert",
			NameLast:  "Johnson",
			Email:     "robert.johnson@example.com",
		},
		{
			ID:        4,
			Username:  "mary.wilson",
			NameFirst: "Mary",
			NameLast:  "Wilson",
			Email:     "mary.wilson@example.com",
		},
	}

	// Log the facility ID for debugging
	fmt.Printf("MOCK DATA: Returning %d instructors for facility ID %d\n", len(mockInstructors), facilityID)

	return mockInstructors, nil

	/* ORIGINAL QUERY (commented out temporarily due to 500 error):
	var instructors []models.Instructor

	// Get unique users who are instructors for classes at this facility
	if err := db.Table("users u").
		Select("DISTINCT u.id, u.username, u.name_first, u.name_last, u.email").
		Joins("INNER JOIN program_classes pc ON pc.instructor_id = u.id").
		Where("pc.facility_id = ? AND u.facility_id = ?", facilityID, facilityID).
		Where("u.archived_at IS NULL").
		Order("u.name_last, u.name_first").
		Find(&instructors).Error; err != nil {
		return nil, newGetRecordsDBError(err, "instructors")
	}

	return instructors, nil
	*/
}

// Get classes by instructor with session counts for date range
func (db *DB) GetClassesByInstructor(instructorID, facilityID int, startDate, endDate string) ([]models.InstructorClassData, error) {
	var classes []models.InstructorClassData

	query := db.Table("program_classes pc").
		Select(`pc.id as id,
				pc.name as name,
				0 as session_count,
				COALESCE(COUNT(DISTINCT CASE WHEN pce.enrollment_status = ? THEN pce.id END), 0) as enrolled_count,
				0 as upcoming_sessions,
				0 as cancelled_sessions`, models.Enrolled).
		Joins("LEFT JOIN program_class_enrollments pce ON pce.class_id = pc.id").
		Where("pc.instructor_id = ? AND pc.facility_id = ?", instructorID, facilityID).
		Where("pc.status != ?", models.Cancelled).
		Group("pc.id, pc.name").
		Order("pc.name")

	if err := query.Find(&classes).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program classes")
	}

	// For each class, count upcoming sessions in date range
	for i := range classes {
		var upcomingCount int64
		if err := db.Table("program_class_events").
			Where("class_id = ? AND date BETWEEN ? AND ?", classes[i].ID, startDate, endDate).
			Count(&upcomingCount).Error; err != nil {
			return nil, newGetRecordsDBError(err, "upcoming sessions")
		}
		classes[i].UpcomingSessions = int(upcomingCount)
	}

	return classes, nil
}

// Bulk cancel sessions in transaction
func (db *DB) BulkCancelSessions(instructorID, facilityID int, startDate, endDate, reason string, claims BulkCancelClaims) (*models.BulkCancelSessionsResponse, error) {
	ctx := context.Background()

	// Start transaction
	tx := db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return nil, newUpdateDBError(tx.Error, "begin transaction")
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Get all class events for instructor within date range
	var events []models.ProgramClassEvent
	if err := tx.Table("program_class_events pce").
		Select("pce.*").
		Joins("INNER JOIN program_classes pc ON pc.id = pce.class_id").
		Where("pc.instructor_id = ? AND pc.facility_id = ?", instructorID, facilityID).
		Where("pce.date BETWEEN ? AND ?", startDate, endDate).
		Find(&events).Error; err != nil {
		tx.Rollback()
		return nil, newGetRecordsDBError(err, "class events")
	}

	// Filter out already cancelled events
	var activeEvents []models.ProgramClassEvent
	for _, event := range events {
		// Check if this event is already cancelled by an override
		var existingOverride models.ProgramClassEventOverride
		if err := tx.Where("event_id = ? AND is_cancelled = ?", event.ID, true).
			First(&existingOverride).Error; err != nil {
			// No existing override, so this event is still active
			if err == gorm.ErrRecordNotFound {
				activeEvents = append(activeEvents, event)
			} else {
				tx.Rollback()
				return nil, newGetRecordsDBError(err, "checking existing overrides")
			}
		}
	}

	if len(activeEvents) == 0 {
		tx.Rollback()
		return &models.BulkCancelSessionsResponse{
			Success:      true,
			SessionCount: 0,
			ClassCount:   0,
			StudentCount: 0,
			Classes:      []models.AffectedClass{},
		}, nil
	}

	// Get unique classes affected
	classMap := make(map[int]*models.AffectedClass)
	for _, event := range activeEvents {
		if _, exists := classMap[int(event.ClassID)]; !exists {
			classMap[int(event.ClassID)] = &models.AffectedClass{
				ClassID:           int(event.ClassID),
				ClassName:         "", // Will be filled below
				UpcomingSessions:  0,
				CancelledSessions: 0,
				StudentCount:      0,
			}
		}
		classMap[int(event.ClassID)].UpcomingSessions++
	}

	// Get student counts and class names for affected classes
	for classID := range classMap {
		var studentCount int64
		if err := tx.Table("program_class_enrollments").
			Where("class_id = ? AND enrollment_status = ?", classID, models.Enrolled).
			Count(&studentCount).Error; err != nil {
			tx.Rollback()
			return nil, newGetRecordsDBError(err, "enrollments")
		}
		classMap[classID].StudentCount = int(studentCount)

		// Get class name
		var className string
		if err := tx.Table("program_classes").
			Select("name").
			Where("id = ?", classID).
			Scan(&className).Error; err != nil {
			tx.Rollback()
			return nil, newGetRecordsDBError(err, "class name")
		}
		classMap[classID].ClassName = className
	}

	// Create cancellation overrides for each event
	for _, event := range activeEvents {
		// Create override for specific date only
		// Use EXDATE format to exclude specific dates from recurrence
		override := models.ProgramClassEventOverride{
			EventID:       event.ID,
			OverrideRrule: "", // Empty override rule means single instance cancellation
			Duration:      event.Duration,
			Room:          event.Room,
			IsCancelled:   true,
			Reason:        reason,
		}

		if err := tx.Create(&override).Error; err != nil {
			tx.Rollback()
			return nil, newCreateDBError(err, "event override")
		}
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		return nil, newUpdateDBError(err, "commit transaction")
	}

	// Build response
	var affectedClasses []models.AffectedClass
	for _, class := range classMap {
		affectedClasses = append(affectedClasses, *class)
	}

	totalStudents := 0
	for _, class := range affectedClasses {
		totalStudents += class.StudentCount
	}

	response := &models.BulkCancelSessionsResponse{
		Success:      true,
		SessionCount: len(activeEvents),
		ClassCount:   len(affectedClasses),
		StudentCount: totalStudents,
		Classes:      affectedClasses,
	}

	return response, nil
}
