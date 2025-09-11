package database

import (
	"UnlockEdv2/src/models"
	"context"
	"fmt"
	"time"
)

func (db *DB) GetProgramCompletionsForUser(args *models.QueryContext, userId int, classId *int) ([]models.ProgramCompletion, error) {
	content := make([]models.ProgramCompletion, 0)
	tx := db.WithContext(args.Ctx).Model(&models.ProgramCompletion{}).Preload("User").Where("user_id = ?", userId)
	if classId != nil {
		tx = tx.Where("program_class_id = ?", *classId)
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
	tx := db.Model(&models.ProgramClassEnrollment{}).Where("class_id = ?", classId)
	if err := tx.Count(&total).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "program class enrollments")
	}
	if err := tx.Find(&content).Limit(page).Offset(calcOffset(page, perPage)).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "program class enrollments")
	}
	return total, content, nil
}

func (db *DB) GetProgramClassEnrollmentsForFacility(page, perPage int, facilityID uint) (int64, []models.ProgramClassEnrollment, error) {
	content := []models.ProgramClassEnrollment{}
	var total int64 //count
	tx := db.Model(&models.ProgramClassEnrollment{}).
		Joins("JOIN program_classes ps ON program_class_enrollments.class_id = ps.id and ps.deleted_at IS NULL").
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
		Table("program_classes").
		Select("program_classes.status, program_classes.capacity - COALESCE(COUNT(pce.id), 0) AS available").
		Joins(`LEFT JOIN program_class_enrollments pce ON pce.class_id = program_classes.id
			and pce.enrollment_status = 'Enrolled'`).
		Where("program_classes.id = ?", classID).
		Group("program_classes.status, program_classes.id, program_classes.capacity").
		Scan(&result).Error
	if err != nil {
		return 0, newNotFoundDBError(err, "program_classes")
	}

	if result.Available <= 0 {
		return len(userIds), newNotFoundDBError(fmt.Errorf("class is full"), "program_classes")
	}

	enrollments := make([]models.ProgramClassEnrollment, 0, min(len(userIds), result.Available))
	for _, uid := range userIds {
		if result.Available <= 0 {
			break
		}
		enrollments = append(enrollments, models.ProgramClassEnrollment{
			ClassID:          uint(classID),
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

func (db *DB) GraduateEnrollments(ctx context.Context, adminEmail string, userIds []int, classId int) error {
	enrollment := models.ProgramClassEnrollment{}
	// begin transaction
	tx := db.WithContext(ctx).Begin()

	// preload necessary relationships
	err := tx.Model(&models.ProgramClassEnrollment{}).
		Preload("User.Facility").
		Preload("Class.Program.ProgramCreditTypes").
		Preload("Class.FacilityProg").
		First(&enrollment, "class_id = ?", classId).Error
	if err != nil {
		tx.Rollback()
		return newNotFoundDBError(err, "class enrollment")
	}

	creditType := ""
	for i, ct := range enrollment.Class.Program.ProgramCreditTypes {
		if i == len(enrollment.Class.Program.ProgramCreditTypes)-1 {
			creditType += string(ct.CreditType)
		} else {
			creditType += fmt.Sprintf("%s,", ct.CreditType)
		}
	}

	completions := make([]models.ProgramCompletion, 0, len(userIds))
	for i := range userIds {
		completions = append(completions, models.ProgramCompletion{
			ProgramClassID:      uint(classId),
			FacilityName:        enrollment.User.Facility.Name,
			ProgramName:         enrollment.Class.Program.Name,
			ProgramOwner:        enrollment.Class.FacilityProg.ProgramOwner,
			ProgramID:           enrollment.Class.ProgramID,
			AdminEmail:          adminEmail,
			ProgramClassStartDt: enrollment.Class.StartDt,
			CreditType:          creditType,
			ProgramClassName:    enrollment.Class.Name,
			UserID:              uint(userIds[i]),
			EnrolledOnDt:        enrollment.CreatedAt,
		})
	}

	if err = tx.Create(&completions).Error; err != nil {
		tx.Rollback()
		return newCreateDBError(err, "enrollment completion")
	}

	if err = tx.Model(&models.ProgramClassEnrollment{}).
		Where("user_id IN (?) AND class_id = ?", userIds, classId).
		Set("class_id", classId).
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
	if err := db.Model(&models.ProgramClassEnrollment{}).
		Where("class_id = ? AND user_id IN (?)", classId, userIds).
		Set("class_id", classId).
		Updates(updates).Error; err != nil {
		return newUpdateDBError(err, "class enrollment status")
	}
	return nil
}

func (db *DB) UpdateProgramClasses(ctx context.Context, classIDs []int, classMap map[string]any) error {
	tx := db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return newUpdateDBError(tx.Error, "begin transaction")
	}
	defer tx.Rollback()

	var (
		toBeCompletedEnrollments []models.ProgramClassEnrollment
		adminEmail               string
	)

	if status, ok := classMap["status"]; ok &&
		(status == string(models.Cancelled) || status == string(models.Completed)) {
		completionTime := time.Now().UTC()
		if err := db.UpdateClassEventRRuleUntilDate(tx, classIDs, completionTime); err != nil {
			return newUpdateDBError(err, "updating class event rrule until date")
		}
		for _, classID := range classIDs {
			var enrollmentStatus models.ProgramEnrollmentStatus
			switch status {
			case string(models.Cancelled):
				enrollmentStatus = models.EnrollmentCancelled
			case string(models.Completed):
				enrollmentStatus = models.EnrollmentCompleted
			}

			if err := tx.
				Model(&models.ProgramClassEnrollment{}).
				Where("class_id = ? AND enrollment_status = ?", classID, models.Enrolled).
				Set("class_id", classID).
				Update("enrollment_status", enrollmentStatus).
				Error; err != nil {
				return newUpdateDBError(err, "class enrollment statuses")
			}
		}

		// Fetch enrollments that will be used create program completions AFTER the update
		if status == string(models.Completed) {
			if err := tx.Model(&models.ProgramClassEnrollment{}).
				Preload("User.Facility").
				Preload("Class.Program.ProgramCreditTypes").
				Preload("Class.FacilityProg").
				Where("class_id IN (?) AND enrollment_status = ?", classIDs, models.EnrollmentCompleted).
				Find(&toBeCompletedEnrollments).Error; err != nil {
				return newNotFoundDBError(err, "fetching updated enrollments")
			}
		}
	}

	if err := tx.
		Model(&models.ProgramClass{}).
		Where("id IN ?", classIDs).
		Set("class_ids", classIDs).
		Updates(classMap).
		Error; err != nil {
		return newUpdateDBError(err, "program classes")
	}

	if len(toBeCompletedEnrollments) > 0 {
		rawUID, ok := classMap["update_user_id"]
		if !ok {
			return newUpdateDBError(fmt.Errorf("missing update_user_id in classMap"), "program classes")
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

		completions := make([]models.ProgramCompletion, 0, len(toBeCompletedEnrollments))
		for _, enrollment := range toBeCompletedEnrollments {
			completions = append(completions, models.ProgramCompletion{
				ProgramClassID:      enrollment.ClassID,
				FacilityName:        enrollment.User.Facility.Name,
				ProgramName:         enrollment.Class.Program.Name,
				ProgramOwner:        enrollment.Class.GetProgramOwnerOrEmpty(),
				ProgramID:           enrollment.Class.ProgramID,
				AdminEmail:          adminEmail,
				ProgramClassStartDt: enrollment.Class.StartDt,
				CreditType:          enrollment.Class.Program.GetUniqueCreditTypeString(),
				ProgramClassName:    enrollment.Class.Name,
				UserID:              enrollment.UserID,
				EnrolledOnDt:        enrollment.CreatedAt,
			})
		}

		if err := tx.Create(&completions).Error; err != nil {
			return newCreateDBError(err, "enrollment completion")
		}

	}
	var (
		allChanges []models.ChangeLogEntry
		logEntry   models.ChangeLogEntry
	)
	for _, classID := range classIDs {
		for fieldName, value := range classMap {
			if fieldName == "update_user_id" {
				continue
			}
			logEntry = *models.NewChangeLogEntry("program_classes", fieldName, nil, models.StringPtr(value.(string)), uint(classID), classMap["update_user_id"].(uint))
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
	tx := db.WithContext(args.Ctx).Table("program_class_enrollments pse").Select("pse.*, u.name_last || ', ' || u.name_first as name_full, u.doc_id, c.name as class_name, c.start_dt, pc.created_at as completion_dt").
		Joins("JOIN program_classes c ON pse.class_id = c.id AND c.deleted_at IS NULL").
		Joins("JOIN users u ON pse.user_id = u.id AND u.deleted_at IS NULL").
		Joins("LEFT JOIN program_completions pc ON pc.user_id = pse.user_id AND pc.program_class_id = ?", classId).
		Where("pse.class_id = ?", classId)
	if status != "" {
		tx = tx.Where("pse.enrollment_status ILIKE ?", status)
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

func (db *DB) GetProgramClassEnrollmentsAttendance(page, perPage, id int) (int64, []models.ProgramClassEventAttendance, error) {
	content := []models.ProgramClassEventAttendance{}
	var total int64
	tx := db.Table("program_class_event_attendance att").
		Select("*").
		Joins("JOIN program_class_events evt ON att.event_id = evt.id and evt.deleted_at IS NULL").
		Joins("JOIN program_classes ps ON evt.class_id = ps.id and ps.deleted_at IS NULL").
		Joins("JOIN program_class_enrollments pse ON ps.id = pse.class_id and pse.deleted_at IS NULL").
		Where("pse.id = ?", id).
		Where("att.deleted_at IS NULL")

	if err := tx.Count(&total).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "class event")
	}
	if err := tx.Limit(perPage).
		Offset(calcOffset(page, perPage)).
		Find(&content).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "class event attendance")
	}
	return total, content, nil
}
