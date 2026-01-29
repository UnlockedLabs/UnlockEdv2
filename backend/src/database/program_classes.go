package database

import (
	"UnlockEdv2/src/models"
	"fmt"
	"runtime/debug"
	"strings"
	"time"

	log "github.com/sirupsen/logrus"
	"github.com/teambition/rrule-go"
	"golang.org/x/net/context"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type BulkCancelClaims interface {
	GetUserID() uint
	GetFacilityID() uint
	GetTimezone() string
}

func parseDateRange(startDate, endDate string) (time.Time, time.Time, error) {
	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid start date format: %w", err)
	}
	start = time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)

	end, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid end date format: %w", err)
	}
	end = time.Date(end.Year(), end.Month(), end.Day(), 23, 59, 59, 999999999, time.UTC)

	return start, end, nil
}

func (db *DB) GetClassByID(id int) (*models.ProgramClass, error) {
	content := &models.ProgramClass{}
	if err := db.Preload("Events").Preload("Events.Overrides").Preload("Events.RoomRef").Preload("Enrollments").Preload("Program").Preload("Instructor").First(content, "id = ?", id).Error; err != nil {
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
	tx := db.WithContext(args.Ctx).Model(&models.ProgramClass{}).Where("facility_id = ?", args.FacilityID)
	if args.Search != "" {
		tx = tx.Where("LOWER(name) LIKE ?", args.SearchQuery())
	}
	if err := tx.Count(&args.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program classes")
	}
	if err := tx.Limit(args.PerPage).Offset(args.CalcOffset()).Find(&content).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program classes")
	}
	return content, nil
}

func (db *DB) CreateProgramClass(content *models.ProgramClass, conflictReq *models.ConflictCheckRequest) (*models.ProgramClass, []models.RoomConflict, error) {
	if err := Validate().Struct(content); err != nil {
		return nil, nil, newCreateDBError(err, "create program classes validation error")
	}

	if conflictReq == nil {
		if err := db.Create(&content).Error; err != nil {
			return nil, nil, newCreateDBError(err, "program classes")
		}
		return content, nil, nil
	}

	tx := db.Begin()
	if tx.Error != nil {
		return nil, nil, NewDBError(tx.Error, "unable to start transaction")
	}

	conflicts, err := LockRoomAndCheckConflicts(tx, conflictReq)
	if err != nil {
		tx.Rollback()
		return nil, nil, err
	}
	if len(conflicts) > 0 {
		tx.Rollback()
		return nil, conflicts, nil
	}

	if err := tx.Create(&content).Error; err != nil {
		tx.Rollback()
		return nil, nil, newCreateDBError(err, "program classes")
	}

	if err := tx.Commit().Error; err != nil {
		return nil, nil, NewDBError(err, "unable to commit transaction")
	}
	return content, nil, nil
}

func (db *DB) UpdateProgramClass(content *models.ProgramClass, id int, conflictReq *models.ConflictCheckRequest) (*models.ProgramClass, []models.RoomConflict, error) {
	var allChanges []models.ChangeLogEntry
	existing := &models.ProgramClass{}
	if err := db.Preload("Events").First(existing, "id = ?", id).Error; err != nil {
		return nil, nil, newNotFoundDBError(err, "program classes")
	}

	trans := db.Begin()
	if trans.Error != nil {
		return nil, nil, NewDBError(trans.Error, "unable to start the database transaction")
	}

	if conflictReq != nil {
		conflicts, err := LockRoomAndCheckConflicts(trans, conflictReq)
		if err != nil {
			trans.Rollback()
			return nil, nil, err
		}
		if len(conflicts) > 0 {
			trans.Rollback()
			return nil, conflicts, nil
		}
	}

	ignoredFieldNames := []string{"create_user_id", "update_user_id", "enrollments", "facility", "facilities", "events", "facility_program", "program_id", "start_dt", "end_dt", "program", "enrolled", "instructor"}
	classLogEntries := models.GenerateChangeLogEntries(existing, content, "program_classes", existing.ID, models.DerefUint(content.UpdateUserID), ignoredFieldNames)
	allChanges = append(allChanges, classLogEntries...)

	originalInstructorID := existing.InstructorID

	var needsRoomUpdate bool
	var newRoomID *uint
	var eventID uint
	if len(content.Events) > 0 && len(existing.Events) > 0 && content.Events[0].RoomID != nil {
		existingRoomID := existing.Events[0].RoomID
		if existingRoomID == nil || *content.Events[0].RoomID != *existingRoomID {
			needsRoomUpdate = true
			newRoomID = content.Events[0].RoomID
			eventID = existing.Events[0].ID
		}
	}

	models.UpdateStruct(existing, content)

	instructorIDChanged := false
	if originalInstructorID == nil && content.InstructorID != nil {
		instructorIDChanged = true
	} else if originalInstructorID != nil && content.InstructorID == nil {
		instructorIDChanged = true
	} else if originalInstructorID != nil && content.InstructorID != nil && *originalInstructorID != *content.InstructorID {
		instructorIDChanged = true
	}

	if instructorIDChanged {
		existing.InstructorID = content.InstructorID
		existing.InstructorName = content.InstructorName
	}

	if err := trans.Session(&gorm.Session{FullSaveAssociations: false}).Updates(&existing).Error; err != nil {
		trans.Rollback()
		return nil, nil, newUpdateDBError(err, "program classes")
	}

	if needsRoomUpdate {
		if err := trans.Model(&models.ProgramClassEvent{}).Where("id = ?", eventID).Update("room_id", newRoomID).Error; err != nil {
			trans.Rollback()
			return nil, nil, newUpdateDBError(err, "program class event room")
		}
		existing.Events[0].RoomID = newRoomID
	}

	if len(allChanges) > 0 {
		if err := trans.Create(&allChanges).Error; err != nil {
			trans.Rollback()
			return nil, nil, newCreateDBError(err, "change_log_entries")
		}
	}

	if err := trans.Commit().Error; err != nil {
		return nil, nil, NewDBError(err, "unable to commit the database transaction")
	}

	return existing, nil, nil
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
	if args.Search != "" {
		query = query.Where("LOWER(ps.name) LIKE ? OR LOWER(ps.description) LIKE ?", args.SearchQuery(), args.SearchQuery())
	}
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

func (db *DB) GetFacilityInstructors(facilityID int) ([]models.Instructor, error) {
	var instructors []models.Instructor

	if err := db.Table("users u").
		Select("u.id, u.username, u.name_first, u.name_last, u.email").
		Where("u.facility_id = ? AND u.role IN ? AND u.deactivated_at IS NULL", facilityID, []string{"facility_admin", "department_admin"}).
		Order("u.name_first, u.name_last").
		Find(&instructors).Error; err != nil {
		return nil, newGetRecordsDBError(err, "instructors")
	}

	// Prepend "Unassigned" option with ID = 0
	unassigned := models.Instructor{
		ID:        0,
		Username:  "unassigned",
		NameFirst: "Unassigned",
		NameLast:  "",
		Email:     "",
	}

	// Create a new slice with Unassigned first, then the real instructors
	result := make([]models.Instructor, 0, len(instructors)+1)
	result = append(result, unassigned)
	result = append(result, instructors...)

	return result, nil
}

func (db *DB) GetInstructorNameByID(instructorID uint, facilityID uint) (string, error) {
	var instructorName string
	err := db.Table("users").
		Select("COALESCE(name_first || ' ' || name_last, username)").
		Where("id = ? AND facility_id = ? AND role IN ?",
			instructorID, facilityID,
			[]models.UserRole{models.FacilityAdmin, models.DepartmentAdmin}).
		Scan(&instructorName).Error
	if err != nil {
		return "", err
	}
	return instructorName, nil
}

func (db *DB) GetClassesByInstructor(instructorID, facilityID int, startDate, endDate string) ([]models.InstructorClassData, error) {
	var classes []models.InstructorClassData

	// Handle unassigned classes (instructorID = 0)
	var query *gorm.DB
	if instructorID == 0 {
		query = db.Table("program_classes pc").
			Select(`pc.id as id,
					pc.name as name,
					0 as session_count,
					COALESCE(COUNT(DISTINCT CASE WHEN pce.enrollment_status = ? THEN pce.id END), 0) as enrolled_count,
					0 as upcoming_sessions,
					0 as cancelled_sessions`, models.Enrolled).
			Joins("LEFT JOIN program_class_enrollments pce ON pce.class_id = pc.id").
			Where("pc.instructor_id IS NULL AND pc.facility_id = ?", facilityID).
			Where("pc.status != ?", models.Cancelled).
			Group("pc.id, pc.name").
			Order("pc.name")
	} else {
		query = db.Table("program_classes pc").
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
	}

	if err := query.Find(&classes).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program classes")
	}

	start, end, err := parseDateRange(startDate, endDate)
	if err != nil {
		return nil, NewDBError(err, err.Error())
	}

	for i := range classes {
		totalSessions, upcomingSessions, cancelledSessions, err := db.calculateSessionCounts(classes[i].ID, start, end)
		if err != nil {
			return nil, err
		}

		classes[i].SessionCount = totalSessions
		classes[i].UpcomingSessions = upcomingSessions
		classes[i].CancelledSessions = cancelledSessions
	}

	return classes, nil
}

func (db *DB) calculateSessionCounts(classID int, startDate, endDate time.Time) (int, int, int, error) {

	var events []struct {
		models.ProgramClassEvent
		Overrides []models.ProgramClassEventOverride `gorm:"foreignKey:EventID;references:ID"`
	}

	if err := db.Preload("Overrides").Where("class_id = ?", classID).Find(&events).Error; err != nil {
		return 0, 0, 0, newGetRecordsDBError(err, "class events")
	}

	var totalSessions, upcomingSessions, cancelledSessions int

	for _, event := range events {
		rule, err := rrule.StrToRRule(event.RecurrenceRule)
		if err != nil {
			continue // Skip invalid rules
		}

		occurrences := rule.Between(startDate, endDate, true)
		totalSessions += len(occurrences)

		cancelledDates := make(map[string]bool)
		cancelledInDateRange := 0
		for _, override := range event.Overrides {
			if override.IsCancelled {
				overrideRule, err := rrule.StrToRRule(override.OverrideRrule)
				if err != nil {
					continue // Skip invalid override rules
				}

				overrideOccurrences := overrideRule.Between(startDate, endDate, true)
				cancelledInDateRange += len(overrideOccurrences)

				for _, occ := range overrideOccurrences {
					cancelledDates[occ.Format("2006-01-02")] = true
				}
			}
		}

		actualUpcoming := 0
		for _, occurrence := range occurrences {
			if !cancelledDates[occurrence.Format("2006-01-02")] {
				actualUpcoming++
			}
		}
		upcomingSessions += actualUpcoming

		cancelledSessions += cancelledInDateRange
	}

	return totalSessions, upcomingSessions, cancelledSessions, nil
}

func (db *DB) BulkCancelSessions(req *models.BulkCancelSessionsRequest, facilityID int, claims BulkCancelClaims) (*models.BulkCancelSessionsResponse, error) {
	ctx := context.Background()

	if err := Validate().Struct(req); err != nil {
		return nil, NewDBError(err, "bulk cancel sessions validation error")
	}

	tx := db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return nil, newUpdateDBError(tx.Error, "begin transaction")
	}
	defer func() {
		if r := recover(); r != nil {
			if err := tx.Rollback().Error; err != nil {
				log.WithError(err).Error("Error rolling back transaction in BulkCancelSessions after panic")
			}
			log.WithField("stack", string(debug.Stack())).Error("Panic in BulkCancelSessions")
			panic(r)
		}
	}()

	start, end, err := parseDateRange(req.StartDate, req.EndDate)
	if err != nil {
		tx.Rollback()
		return nil, NewDBError(err, err.Error())
	}

	var baseEvents []models.ProgramClassEvent
	var query *gorm.DB
	if req.InstructorID == 0 {
		query = tx.Table("program_class_events pce").
			Select("pce.*").
			Joins("INNER JOIN program_classes pc ON pc.id = pce.class_id").
			Where("pc.instructor_id IS NULL AND pc.facility_id = ?", facilityID)
	} else {
		query = tx.Table("program_class_events pce").
			Select("pce.*").
			Joins("INNER JOIN program_classes pc ON pc.id = pce.class_id").
			Where("pc.instructor_id = ? AND pc.facility_id = ?", req.InstructorID, facilityID)
	}

	if err := query.Find(&baseEvents).Error; err != nil {
		tx.Rollback()
		return nil, newGetRecordsDBError(err, "class events")
	}

	var eventInstances []struct {
		Event      models.ProgramClassEvent
		Occurrence time.Time
	}
	for _, baseEvent := range baseEvents {
		rule, err := baseEvent.GetRRule()
		if err != nil {
			continue
		}
		occurrences := rule.Between(start, end, true)
		firstOccurrence := rule.After(time.Time{}, false)
		canonicalHour, canonicalMinute := getCanonicalHourAndMinute([]time.Time{firstOccurrence}, claims.GetTimezone())
		userLocation, _ := time.LoadLocation(claims.GetTimezone())
		for _, occurrence := range occurrences {
			consistentOccurrence := time.Date(
				occurrence.Year(),
				occurrence.Month(),
				occurrence.Day(),
				canonicalHour,
				canonicalMinute,
				0,
				0,
				userLocation,
			).UTC()
			eventInstances = append(eventInstances, struct {
				Event      models.ProgramClassEvent
				Occurrence time.Time
			}{
				Event:      baseEvent,
				Occurrence: consistentOccurrence,
			})
		}
	}

	if len(eventInstances) == 0 {
		if err := tx.Rollback().Error; err != nil {
			log.WithError(err).Error("Error rolling back transaction in BulkCancelSessions")
		}
		return &models.BulkCancelSessionsResponse{
			Success:      false,
			SessionCount: 0,
			ClassCount:   0,
			StudentCount: 0,
			Classes:      []models.AffectedClass{},
		}, nil
	}

	// Get unique classes affected and count cancelled sessions
	classMap := make(map[int]*models.AffectedClass)
	for _, instance := range eventInstances {
		if _, exists := classMap[int(instance.Event.ClassID)]; !exists {
			classMap[int(instance.Event.ClassID)] = &models.AffectedClass{
				ClassID:           int(instance.Event.ClassID),
				ClassName:         "",
				UpcomingSessions:  0,
				CancelledSessions: 0,
				StudentCount:      0,
			}
		}
		classMap[int(instance.Event.ClassID)].CancelledSessions++
	}

	classIDs := make([]int, 0, len(classMap))
	for classID := range classMap {
		classIDs = append(classIDs, classID)
	}

	type enrollmentCount struct {
		ClassID int   `gorm:"column:class_id"`
		Count   int64 `gorm:"column:count"`
	}
	var counts []enrollmentCount
	if err := tx.Table("program_class_enrollments").
		Select("class_id, COUNT(*) as count").
		Where("class_id IN ? AND enrollment_status = ?", classIDs, models.Enrolled).
		Group("class_id").
		Scan(&counts).Error; err != nil {
		tx.Rollback()
		return nil, newGetRecordsDBError(err, "enrollments")
	}

	type classInfo struct {
		ID   int    `gorm:"column:id"`
		Name string `gorm:"column:name"`
	}
	var classInfos []classInfo
	if err := tx.Table("program_classes").
		Select("id, name").
		Where("id IN ?", classIDs).
		Scan(&classInfos).Error; err != nil {
		tx.Rollback()
		return nil, newGetRecordsDBError(err, "class names")
	}

	countMap := make(map[int]int64)
	for _, c := range counts {
		countMap[c.ClassID] = c.Count
	}
	nameMap := make(map[int]string)
	for _, info := range classInfos {
		nameMap[info.ID] = info.Name
	}

	for classID := range classMap {
		classMap[classID].StudentCount = int(countMap[classID])
		classMap[classID].ClassName = nameMap[classID]
	}

	existingOverridesMap := make(map[uint]map[string]bool)

	eventIDs := make([]uint, 0, len(eventInstances))
	rruleMap := make(map[string]bool)
	for _, instance := range eventInstances {
		eventIDs = append(eventIDs, instance.Event.ID)
		overrideRrule := fmt.Sprintf("DTSTART:%s\nRRULE:FREQ=DAILY;COUNT=1",
			instance.Occurrence.Format("20060102T150405Z"))
		rruleMap[overrideRrule] = true
	}

	if len(eventIDs) > 0 {
		var existingOverrides []models.ProgramClassEventOverride
		rruleList := make([]string, 0, len(rruleMap))
		for rrule := range rruleMap {
			rruleList = append(rruleList, rrule)
		}

		if err := tx.Table("program_class_event_overrides").
			Where("event_id IN ? AND override_rrule IN ? AND is_cancelled = ? AND deleted_at IS NULL",
				eventIDs, rruleList, true).
			Find(&existingOverrides).Error; err != nil {
			tx.Rollback()
			return nil, newGetRecordsDBError(err, "existing overrides")
		}

		for _, override := range existingOverrides {
			if existingOverridesMap[override.EventID] == nil {
				existingOverridesMap[override.EventID] = make(map[string]bool)
			}
			existingOverridesMap[override.EventID][override.OverrideRrule] = true
		}
	}
	var newCancellations []struct {
		Event      models.ProgramClassEvent
		Occurrence time.Time
	}
	var alreadyCancelled []struct {
		Event      models.ProgramClassEvent
		Occurrence time.Time
	}

	for _, instance := range eventInstances {
		overrideRrule := fmt.Sprintf("DTSTART:%s\nRRULE:FREQ=DAILY;COUNT=1",
			instance.Occurrence.Format("20060102T150405Z"))

		// Check if this override already exists
		if eventOverrides, exists := existingOverridesMap[instance.Event.ID]; exists {
			if eventOverrides[overrideRrule] {
				// Already cancelled
				alreadyCancelled = append(alreadyCancelled, instance)
				continue
			}
		}
		newCancellations = append(newCancellations, instance)
	}

	classMap = make(map[int]*models.AffectedClass)
	for _, instance := range newCancellations {
		if _, exists := classMap[int(instance.Event.ClassID)]; !exists {
			classMap[int(instance.Event.ClassID)] = &models.AffectedClass{
				ClassID:           int(instance.Event.ClassID),
				ClassName:         "",
				UpcomingSessions:  0,
				CancelledSessions: 0,
				StudentCount:      0,
			}
		}
		classMap[int(instance.Event.ClassID)].CancelledSessions++
	}

	for classID := range classMap {
		classMap[classID].StudentCount = int(countMap[classID])
		classMap[classID].ClassName = nameMap[classID]
	}

	var overrides []models.ProgramClassEventOverride
	var auditEntries []models.ChangeLogEntry
	for _, instance := range newCancellations {
		overrideRrule := fmt.Sprintf("DTSTART:%s\nRRULE:FREQ=DAILY;COUNT=1",
			instance.Occurrence.Format("20060102T150405Z"))

		overrides = append(overrides, models.ProgramClassEventOverride{
			EventID:       instance.Event.ID,
			OverrideRrule: overrideRrule,
			Duration:      instance.Event.Duration,
			Room:          instance.Event.Room,
			IsCancelled:   true,
			Reason:        req.Reason,
		})

		oldStatus := "Scheduled"
		newStatus := "Cancelled"

		auditEntry := models.NewChangeLogEntry(
			"program_classes",
			"status",
			&oldStatus,
			&newStatus,
			instance.Event.ClassID,
			claims.GetUserID(),
		)
		auditEntries = append(auditEntries, *auditEntry)
	}

	// Bulk insert overrides with ON CONFLICT DO NOTHING for idempotency (unique partial index on event_id, override_rrule WHERE deleted_at IS NULL).
	if len(overrides) > 0 {
		const overrideBatchSize = 100
		if err := tx.Clauses(clause.OnConflict{
			Columns:     []clause.Column{{Name: "event_id"}, {Name: "override_rrule"}},
			TargetWhere: clause.Where{Exprs: []clause.Expression{clause.Expr{SQL: "deleted_at IS NULL"}}},
			DoNothing:   true,
		}).CreateInBatches(overrides, overrideBatchSize).Error; err != nil {
			tx.Rollback()
			return nil, newCreateDBError(err, "event override")
		}
	}

	if len(auditEntries) > 0 {
		if err := tx.Create(&auditEntries).Error; err != nil {
			tx.Rollback()
			return nil, newCreateDBError(err, "change log entries")
		}
	}

	if err := tx.Commit().Error; err != nil {
		return nil, newUpdateDBError(err, "commit transaction")
	}

	var affectedClasses []models.AffectedClass
	for _, class := range classMap {
		affectedClasses = append(affectedClasses, *class)
	}

	totalStudents := 0
	for _, class := range affectedClasses {
		totalStudents += class.StudentCount
	}

	alreadyCancelledCount := len(alreadyCancelled)
	var message string
	if alreadyCancelledCount > 0 {
		if len(newCancellations) == 0 {
			message = fmt.Sprintf("All %d sessions in the selected range were already cancelled.", alreadyCancelledCount)
		} else {
			message = fmt.Sprintf("Successfully cancelled %d sessions. %d sessions were already cancelled and were skipped.",
				len(newCancellations), alreadyCancelledCount)
		}
	}

	response := &models.BulkCancelSessionsResponse{
		Success:               true,
		SessionCount:          len(newCancellations),
		ClassCount:            len(affectedClasses),
		StudentCount:          totalStudents,
		AlreadyCancelledCount: alreadyCancelledCount,
		Message:               message,
		Classes:               affectedClasses,
	}

	return response, nil
}
