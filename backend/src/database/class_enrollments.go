package database

import (
	"UnlockEdv2/src/models"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// completionPreloads are the associations newClassCompletion needs to build a complete
// certificate snapshot. Both completion paths must use these -- a missing preload here
// produces a certificate with blank denormalized fields rather than an error.
func completionPreloads(tx *gorm.DB) *gorm.DB {
	return tx.Preload("User.Facility").
		Preload("Cohort.Program.ProgramCreditTypes").
		Preload("Cohort.FacilityProg").
		Preload("Cohort.Class.CreditTypes")
}

// newClassCompletion builds the certificate for one completed enrollment.
//
// The denormalized snapshot is the point of this record: it must survive the cohort,
// class, or program being renamed or deleted later. So everything is copied by value
// here, and every dereference is nil-guarded -- a missing association must not panic
// mid-graduation. (Pre-id751, GraduateEnrollments raw-dereferenced FacilityProg and
// would panic where the other completion path used the nil-safe accessor.)
func newClassCompletion(e models.ProgramClassEnrollment, adminEmail string) models.ClassCompletion {
	completion := models.ClassCompletion{
		UserID:       e.UserID,
		AdminEmail:   adminEmail,
		EnrolledOnDt: e.CreatedAt,
	}

	// Both are pointers on purpose: the FKs are ON DELETE SET NULL so a deleted cohort
	// cannot erase an earned certificate.
	if e.CohortID != 0 {
		cohortID := e.CohortID
		completion.CohortID = &cohortID
	}
	if e.ClassID != 0 {
		classID := e.ClassID
		completion.ClassID = &classID
	}
	if e.User != nil && e.User.Facility != nil {
		completion.FacilityName = e.User.Facility.Name
	}
	if e.Cohort == nil {
		return completion
	}

	// The class's name, not the cohort's -- the cohort has none. Preferring the preloaded
	// association and falling back to the joined alias means this works whether the caller
	// used completionPreloads or a query that only selected `pc.name AS class_name`.
	if e.Cohort.Class != nil {
		completion.ClassName = e.Cohort.Class.Name
	} else {
		completion.ClassName = e.Cohort.ClassName
	}
	completion.CohortStartDt = e.Cohort.StartDt
	completion.ProgramOwner = e.Cohort.GetProgramOwnerOrEmpty()
	if e.Cohort.ProgramID != 0 {
		programID := e.Cohort.ProgramID
		completion.ProgramID = &programID
	}
	if e.Cohort.Program != nil {
		completion.ProgramName = e.Cohort.Program.Name
	}
	completion.CreditType = resolveCreditTypeString(e.Cohort)

	return completion
}

// resolveCreditTypeString applies the empty-means-inherit rule: a class's own credit
// types win, and a class with none inherits its program's. Formatted as the existing
// comma-joined snapshot string so reports and exports are unchanged.
func resolveCreditTypeString(cohort *models.ProgramClassCohort) string {
	var programTypes []models.CreditType
	if cohort.Program != nil {
		for _, ct := range cohort.Program.ProgramCreditTypes {
			programTypes = append(programTypes, ct.CreditType)
		}
	}

	resolved := programTypes
	if cohort.Class != nil {
		resolved = cohort.Class.CreditTypesOrInherited(programTypes)
	}

	seen := make(map[models.CreditType]struct{}, len(resolved))
	unique := make([]string, 0, len(resolved))
	for _, ct := range resolved {
		if _, dup := seen[ct]; dup {
			continue
		}
		seen[ct] = struct{}{}
		unique = append(unique, string(ct))
	}
	return strings.Join(unique, ",")
}

func (db *DB) GetClassCompletionsForUser(args *models.QueryContext, userId int, classId *int) ([]models.ClassCompletion, error) {
	content := make([]models.ClassCompletion, 0)
	tx := db.WithContext(args.Ctx).Model(&models.ClassCompletion{}).Preload("User").Where("user_id = ?", userId)
	if classId != nil {
		tx = tx.Where("cohort_id = ?", *classId)
	}
	if err := tx.Count(&args.Total).Error; err != nil {
		return nil, newNotFoundDBError(err, "program class enrollments")
	}
	if err := tx.Find(&content).Error; err != nil {
		return nil, newNotFoundDBError(err, "program class enrollments")
	}
	return content, nil
}

func (db *DB) GetProgramClassEnrollmentsByID(id int) (*models.ProgramClassEnrollment, error) {
	content := &models.ProgramClassEnrollment{}
	if err := db.First(content, "id = ?", id).Error; err != nil {
		return nil, newNotFoundDBError(err, "class enrollments")
	}
	return content, nil
}

func (db *DB) GetEnrollmentsForClass(page, perPage, classId int) (int64, []models.ProgramClassEnrollment, error) {
	content := []models.ProgramClassEnrollment{}
	var total int64
	tx := db.Model(&models.ProgramClassEnrollment{}).Where("cohort_id = ?", classId)
	if err := tx.Count(&total).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "program class enrollments")
	}
	if err := tx.Limit(perPage).Offset(calcOffset(page, perPage)).Find(&content).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "program class enrollments")
	}
	return total, content, nil
}

func (db *DB) GetProgramClassEnrollmentsForFacility(page, perPage int, facilityID uint) (int64, []models.ProgramClassEnrollment, error) {
	content := []models.ProgramClassEnrollment{}
	var total int64 //count
	tx := db.Model(&models.ProgramClassEnrollment{}).
		Joins("JOIN program_class_cohorts ps ON program_class_enrollments.cohort_id = ps.id and ps.deleted_at IS NULL").
		Where("ps.facility_id = ?", facilityID)

	_ = tx.Count(&total)

	if err := tx.Limit(perPage).
		Offset(calcOffset(page, perPage)).
		Find(&content).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "program class enrollments")
	}
	return total, content, nil
}

// Returns the number of enrollments that were skipped, and possible error
func (db *DB) CreateProgramClassEnrollments(classID int, userIds []int) (int, error) {
	var result struct {
		Available int
		Status    models.ClassStatus
	}
	err := db.
		Table("program_class_cohorts").
		Select("program_class_cohorts.status, program_class_cohorts.capacity - COALESCE(COUNT(pce.id), 0) AS available").
		Joins(`LEFT JOIN program_class_enrollments pce ON pce.cohort_id = program_class_cohorts.id
			and pce.enrollment_status = 'Enrolled'`).
		Where("program_class_cohorts.id = ?", classID).
		Group("program_class_cohorts.status, program_class_cohorts.id, program_class_cohorts.capacity").
		Scan(&result).Error
	if err != nil {
		return 0, newNotFoundDBError(err, "program class cohort")
	}

	if result.Available <= 0 {
		return len(userIds), newNotFoundDBError(fmt.Errorf("class is full"), "program class cohort")
	}

	enrollments := make([]models.ProgramClassEnrollment, 0, min(len(userIds), result.Available))
	for _, uid := range userIds {
		if result.Available <= 0 {
			break
		}
		enrollments = append(enrollments, models.ProgramClassEnrollment{
			CohortID:         uint(classID),
			UserID:           uint(uid),
			EnrollmentStatus: models.Enrolled,
		})
		result.Available--
	}

	skipped := len(userIds) - len(enrollments)
	if err := db.Create(&enrollments).Error; err != nil {
		return 0, newCreateDBError(err, "class enrollment")
	}

	return skipped, nil
}

func (db *DB) DeleteProgramClassEnrollments(id int) error {
	if err := db.Model(&models.ProgramClassEnrollment{}).Delete(&models.ProgramClassEnrollment{}, "id = ?", id).Error; err != nil {
		return newDeleteDBError(err, "class enrollment")
	}
	return nil
}

// GraduateEnrollments marks residents in one COHORT as completed and issues each of them
// the parent CLASS's certificate. cohortId is a cohort id, not a class id.
func (db *DB) GraduateEnrollments(adminEmail string, userIds []int, cohortId int) error {
	tx := db.Begin()

	var enrollments []models.ProgramClassEnrollment
	err := completionPreloads(tx.Model(&models.ProgramClassEnrollment{})).
		Where("cohort_id = ? AND user_id IN (?)", cohortId, userIds).
		Find(&enrollments).Error
	if err != nil {
		tx.Rollback()
		return newNotFoundDBError(err, "class enrollment")
	}
	if len(enrollments) == 0 {
		tx.Rollback()
		return newNotFoundDBError(fmt.Errorf("no enrollments found"), "class enrollment")
	}

	completions := make([]models.ClassCompletion, 0, len(enrollments))
	for _, enrollment := range enrollments {
		completions = append(completions, newClassCompletion(enrollment, adminEmail))
	}

	// DO NOTHING, not an error: the certificate is per (user, class), so a resident who
	// already earned it in a sibling cohort keeps the original earn date rather than
	// getting a duplicate or a 500. Enforced by class_completions_user_class_uniq.
	if err = tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&completions).Error; err != nil {
		tx.Rollback()
		return newCreateDBError(err, "enrollment completion")
	}

	if err = tx.Model(&models.ProgramClassEnrollment{}).
		Where("user_id IN (?) AND cohort_id = ?", userIds, cohortId).
		Set("cohort_id", cohortId).
		Update("enrollment_status", models.EnrollmentCompleted).Error; err != nil {
		tx.Rollback()
		return newUpdateDBError(err, "enrollment status")
	}

	// commit the transaction
	return tx.Commit().Error
}

func (db *DB) UpdateProgramClassEnrollments(classId int, userIds []int, status models.ProgramEnrollmentStatus, changeReason *string) error {
	updates := map[string]any{
		"enrollment_status": status,
	}
	if changeReason != nil {
		updates["change_reason"] = *changeReason
	}
	if ctx := db.Statement.Context; ctx != nil {
		if userID, ok := ctx.Value(models.UserIDKey).(uint); ok {
			updates["update_user_id"] = userID
		}
	}
	if err := db.Model(&models.ProgramClassEnrollment{}).
		Where("cohort_id = ? AND user_id IN (?)", classId, userIds).
		Set("cohort_id", classId).
		Updates(updates).Error; err != nil {
		return newUpdateDBError(err, "class enrollment status")
	}
	return nil
}

func (db *DB) UpdateProgramClassEnrollmentDate(enrollmentId int, enrolledDate time.Time) error {
	update := map[string]any{"enrolled_at": enrolledDate}
	if ctx := db.Statement.Context; ctx != nil {
		if userID, ok := ctx.Value(models.UserIDKey).(uint); ok {
			update["update_user_id"] = userID
		}
	}
	if err := db.Model(&models.ProgramClassEnrollment{}).
		Where("id = ?", enrollmentId).
		Updates(update).Error; err != nil {
		return newUpdateDBError(err, "enrollment date")
	}
	return nil
}

// UpdateProgramCohorts updates COHORT rows (status, dates, capacity) and cascades the
// consequences: terminating enrollments, issuing certificates, and writing the audit log.
// cohortIDs are cohort ids -- status is a cohort-level concept, a class has none.
func (db *DB) UpdateProgramCohorts(cohortIDs []int, cohortMap map[string]any) error {
	tx := db.Begin()
	if tx.Error != nil {
		return newUpdateDBError(tx.Error, "begin transaction")
	}
	defer tx.Rollback()

	var (
		toBeCompletedEnrollments []models.ProgramClassEnrollment
		adminEmail               string
	)

	if status, ok := cohortMap["status"]; ok &&
		(status == string(models.Cancelled) || status == string(models.Completed)) {
		completionTime := time.Now().UTC()
		if err := db.UpdateClassEventRRuleUntilDate(tx, cohortIDs, completionTime); err != nil {
			return newUpdateDBError(err, "updating class event rrule until date")
		}
		for _, cohortID := range cohortIDs {
			var enrollmentStatus models.ProgramEnrollmentStatus
			switch status {
			case string(models.Cancelled):
				enrollmentStatus = models.EnrollmentCancelled
			case string(models.Completed):
				enrollmentStatus = models.EnrollmentCompleted
			}

			if err := tx.
				Model(&models.ProgramClassEnrollment{}).
				Where("cohort_id = ? AND enrollment_status = ?", cohortID, models.Enrolled).
				Set("cohort_id", cohortID).
				Update("enrollment_status", enrollmentStatus).
				Error; err != nil {
				return newUpdateDBError(err, "class enrollment statuses")
			}
		}

		// Fetch enrollments that will be used create program completions AFTER the update
		if status == string(models.Completed) {
			if err := completionPreloads(tx.Model(&models.ProgramClassEnrollment{})).
				Where("cohort_id IN (?) AND enrollment_status = ?", cohortIDs, models.EnrollmentCompleted).
				Find(&toBeCompletedEnrollments).Error; err != nil {
				return newNotFoundDBError(err, "fetching updated enrollments")
			}
		}
	}

	if err := tx.
		Model(&models.ProgramClassCohort{}).
		Where("id IN ?", cohortIDs).
		Set("cohort_ids", cohortIDs).
		Updates(cohortMap).
		Error; err != nil {
		return newUpdateDBError(err, "program classes")
	}

	if len(toBeCompletedEnrollments) > 0 {
		rawUID, ok := cohortMap["update_user_id"]
		if !ok {
			return newUpdateDBError(fmt.Errorf("missing update_user_id in cohortMap"), "program classes")
		}

		updateUserID, ok := rawUID.(uint)
		if !ok {
			return newUpdateDBError(fmt.Errorf("update_user_id must be of type uint"), "program classes")
		}

		var admin models.User
		if err := tx.First(&admin, "id = ?", updateUserID).Error; err != nil {
			return newNotFoundDBError(err, "admin user")
		}
		adminEmail = admin.Email

		completions := make([]models.ClassCompletion, 0, len(toBeCompletedEnrollments))
		for _, enrollment := range toBeCompletedEnrollments {
			completions = append(completions, newClassCompletion(enrollment, adminEmail))
		}

		// see the note in GraduateEnrollments -- one certificate per (user, class)
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&completions).Error; err != nil {
			return newCreateDBError(err, "enrollment completion")
		}

	}
	var (
		allChanges []models.ChangeLogEntry
		logEntry   models.ChangeLogEntry
	)
	for _, cohortID := range cohortIDs {
		for fieldName, value := range cohortMap {
			if fieldName == "update_user_id" {
				continue
			}
			logEntry = *models.NewChangeLogEntry(models.TableNameCohort, fieldName, nil, models.StringPtr(value.(string)), uint(cohortID), cohortMap["update_user_id"].(uint))
			allChanges = append(allChanges, logEntry)
		}
	}
	if len(allChanges) > 0 {
		if err := tx.Create(&allChanges).Error; err != nil {
			return newCreateDBError(err, "change_log_entries")
		}
	}

	if err := tx.Commit().Error; err != nil {
		return newUpdateDBError(err, "unable to commit database transaction")
	}

	return nil
}

type EnrollmentDetails struct {
	models.ProgramClassEnrollment
	NameFull     string `json:"name_full"`
	DocID        string `json:"doc_id"`
	ClassName    string `json:"class_name"`
	StartDt      string `json:"start_dt"`
	CompletionDt string `json:"completion_dt"`
}

func (db *DB) GetProgramClassEnrollmentsForProgram(args *models.QueryContext, classId int, status string) ([]EnrollmentDetails, error) {
	content := make([]EnrollmentDetails, 0, args.PerPage)
	search := args.SearchQuery()
	tx := db.WithContext(args.Ctx).Table("program_class_enrollments pse").Select("pse.*, u.name_first || ' ' || u.name_last as name_full, u.doc_id, cl.name as class_name, c.start_dt, pc.created_at as completion_dt").
		Joins("JOIN program_class_cohorts c ON pse.cohort_id = c.id AND c.deleted_at IS NULL").
		Joins("JOIN program_classes cl ON cl.id = c.class_id").
		Joins("JOIN users u ON pse.user_id = u.id AND u.deleted_at IS NULL").
		Joins("LEFT JOIN class_completions pc ON pc.user_id = pse.user_id AND pc.cohort_id = ?", classId).
		Where("pse.cohort_id = ?", classId)
	if status != "" {
		if status == "not_enrolled" {
			tx = tx.Where("pse.enrollment_status != ?", "Enrolled")
		} else {
			tx = tx.Where("pse.enrollment_status ILIKE ?", status)
		}
	}
	if search != "" {
		tx = tx.Where("u.name_last ILIKE ? OR u.name_first ILIKE ? OR u.doc_id ILIKE ?", search, search, search)
	}

	if err := tx.Count(&args.Total).Error; err != nil {
		return nil, newNotFoundDBError(err, "program class enrollments")
	}
	if err := tx.Limit(args.PerPage).
		Offset(args.CalcOffset()).Order(adjustUserOrderBy(args.OrderClause("pse.created_at desc"))).
		Find(&content).Error; err != nil {
		return nil, newNotFoundDBError(err, "program class enrollments")
	}
	return content, nil
}

func (db *DB) GetProgramClassEnrollmentsAttendance(page, perPage, id int) (int64, []models.AttendanceRecordResponse, error) {
	content := []models.AttendanceRecordResponse{}
	var total int64
	tx := db.Table("program_class_event_attendance att").
		Select(`att.user_id, att.date, att.attendance_status, att.note,
			COALESCE(CONCAT(admin.name_first, ' ', admin.name_last), '') AS marked_by`).
		Joins("JOIN program_class_events evt ON att.event_id = evt.id AND evt.deleted_at IS NULL").
		Joins("JOIN program_class_cohorts ps ON evt.cohort_id = ps.id AND ps.deleted_at IS NULL").
		Joins("JOIN program_class_enrollments pse ON ps.id = pse.cohort_id AND pse.deleted_at IS NULL").
		Joins("LEFT JOIN users admin ON att.create_user_id = admin.id").
		Where("pse.id = ?", id).
		Where("att.user_id = pse.user_id").
		Where("att.deleted_at IS NULL")

	if err := tx.Count(&total).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "class event")
	}
	if err := tx.Order("att.date DESC").Limit(perPage).
		Offset(calcOffset(page, perPage)).
		Find(&content).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "class event attendance")
	}
	return total, content, nil
}

func (db *DB) CheckSchedulingConflicts(cohortID int, userIDs []int) ([]models.ConflictDetail, error) {
	var conflicts []models.ConflictDetail
	allEventsQuery := &models.QueryContext{All: true}
	targetEvents, err := db.GetClassEvents(allEventsQuery, cohortID)
	if err != nil {
		return nil, err
	}

	if len(targetEvents) == 0 {
		return nil, nil
	}

	var allEnrollments []models.ProgramClassEnrollment
	if err := db.Model(&models.ProgramClassEnrollment{}).
		Preload("Class").
		Where("user_id IN (?) AND enrollment_status = ?", userIDs, models.Enrolled).
		Find(&allEnrollments).Error; err != nil {
		return nil, err
	}

	enrollmentsByUser := make(map[int][]models.ProgramClassEnrollment)
	for _, enrollment := range allEnrollments {
		uid := int(enrollment.UserID)
		enrollmentsByUser[uid] = append(enrollmentsByUser[uid], enrollment)
	}

	for _, userID := range userIDs {
		existingEnrollments := enrollmentsByUser[userID]
		if len(existingEnrollments) == 0 {
			continue
		}

		for _, enrollment := range existingEnrollments {
			if int(enrollment.ClassID) == cohortID {
				continue
			}

			existingClassEvents, err := db.GetClassEvents(allEventsQuery, int(enrollment.ClassID))
			if err != nil {
				return nil, err
			}

			if hasOverlap, start, end, days := checkEventsOverlap(targetEvents, existingClassEvents); hasOverlap {
				var user models.User
				if err := db.First(&user, userID).Error; err != nil {
					return nil, err
				}

				conflicts = append(conflicts, models.ConflictDetail{
					UserID:           uint(userID),
					UserName:         user.NameLast + ", " + user.NameFirst,
					ConflictingClass: enrollment.Class.Name,
					ConflictStart:    start,
					ConflictEnd:      end,
					ConflictDays:     days,
				})
			}
		}
	}

	return conflicts, nil
}

func checkEventsOverlap(newEvents, existingEvents []models.ProgramClassEvent) (bool, time.Time, time.Time, []string) {
	startWindow := time.Now().UTC()
	endWindow := startWindow.AddDate(0, 6, 0)

	var newInstances []models.EventInstance
	for _, evt := range newEvents {
		insts := generateEventInstances(evt, startWindow, endWindow)
		newInstances = append(newInstances, insts...)
	}

	var existingInstances []models.EventInstance
	for _, evt := range existingEvents {
		insts := generateEventInstances(evt, startWindow, endWindow)
		existingInstances = append(existingInstances, insts...)
	}

	var firstStart, firstEnd time.Time
	seenDays := make(map[time.Weekday]bool)
	for _, newInst := range newInstances {
		newStart := newInst.StartTime
		newEnd := newStart.Add(newInst.Duration)

		for _, exInst := range existingInstances {
			exStart := exInst.StartTime
			exEnd := exStart.Add(exInst.Duration)

			if newStart.Before(exEnd) && newEnd.After(exStart) {
				if firstStart.IsZero() {
					firstStart, firstEnd = newStart, newEnd
				}
				seenDays[newStart.Weekday()] = true
			}
		}
	}

	if len(seenDays) == 0 {
		return false, time.Time{}, time.Time{}, nil
	}

	days := make([]string, 0, len(seenDays))
	for wd := time.Sunday; wd <= time.Saturday; wd++ {
		if seenDays[wd] {
			days = append(days, wd.String())
		}
	}
	return true, firstStart, firstEnd, days
}
