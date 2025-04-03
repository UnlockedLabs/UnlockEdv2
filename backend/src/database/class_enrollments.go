package database

import (
	"UnlockEdv2/src/models"
	"context"
	"fmt"
)

func (db *DB) GetProgramClassEnrollmentsForUser(args *models.QueryContext) ([]models.ProgramClassEnrollment, error) {
	content := []models.ProgramClassEnrollment{}
	tx := db.WithContext(args.Ctx).Model(&models.ProgramClassEnrollment{}).Where("user_id = ?", args.UserID)
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

func (db *DB) CreateProgramClassEnrollments(classID, userID int) error {

	enrollment := &models.ProgramClassEnrollment{
		ClassID:          uint(classID),
		UserID:           uint(userID),
		EnrollmentStatus: "Enrolled",
	}
	if err := db.Create(enrollment).Error; err != nil {
		return newCreateDBError(err, "class enrollment")
	}
	return nil
}

func (db *DB) DeleteProgramClassEnrollments(id int) error {
	if err := db.Model(&models.ProgramClassEnrollment{}).Delete(&models.ProgramClassEnrollment{}, "id = ?", id).Error; err != nil {
		return newDeleteDBError(err, "class enrollment")
	}
	return nil
}

func (db *DB) GraduateEnrollments(ctx context.Context, adminEmail string, completions []models.ProgramCompletion) error {
	// Get the relevant data to attach to the completion
	enrollment := models.ProgramClassEnrollment{}
	err := db.WithContext(ctx).Model(&models.ProgramClassEnrollment{}).
		Preload("User.Facility").
		Preload("Class.Program.ProgramCreditTypes").
		Preload("Class.FacilityProg").
		First(&enrollment, "class_id = ?", completions[0].ProgramClassID).Error
	if err != nil {
		return newNotFoundDBError(err, "class enrollment")
	}
	creditType := ""
	for i, ct := range enrollment.Class.Program.ProgramCreditTypes {
		if i == len(enrollment.Class.Program.ProgramCreditTypes)-1 {
			creditType += fmt.Sprintf("%s", ct.CreditType)
		} else {
			creditType += fmt.Sprintf("%s,", ct.CreditType)
		}
	}
	for i := range completions {
		completions[i].FacilityName = enrollment.User.Facility.Name
		completions[i].ProgramName = enrollment.Class.Program.Name
		completions[i].ProgramOwner = enrollment.Class.FacilityProg.ProgramOwner
		completions[i].ProgramID = enrollment.Class.ProgramID
		completions[i].AdminEmail = adminEmail
		completions[i].ProgramClassStartDt = enrollment.Class.StartDt
		completions[i].CreditType = creditType
		completions[i].ProgramClassName = enrollment.Class.Name
	}
	if err = db.WithContext(ctx).Create(&completions).Error; err != nil {
		return newCreateDBError(err, "enrollment completion")
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

func (db *DB) GetProgramClassEnrollmentsForProgram(args *models.QueryContext, progId, classId int, status string) ([]EnrollmentDetails, error) {
	content := make([]EnrollmentDetails, 0, args.PerPage)
	tx := db.WithContext(args.Ctx).Table("program_class_enrollments pse").Select("pse.*, u.name_last || ' ' || u.name_first as name_full, u.doc_id, s.name, s.start_dt, pc.created_at as completion_dt").
		Joins("JOIN program_classes ON pse.class_id = s.id AND s.deleted_at IS NULL").
		Joins("JOIN users u ON pse.user_id = u.id AND u.deleted_at IS NULL").
		Joins("LEFT JOIN program_completions pc ON pse.class_id = pc.program_class_id AND pc.user_id = pse.user_id").
		Where("pse.class_id = ?", classId)
	if status != "" {
		tx = tx.Where("LOWER(pse.enrollment_status) = ?", status)
	}

	if err := tx.Count(&args.Total).Error; err != nil {
		return nil, newNotFoundDBError(err, "program class enrollments")
	}
	if err := tx.Limit(args.PerPage).
		Offset(args.CalcOffset()).Order(args.OrderClause()).
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

func (db *DB) GetProgramClassEnrollmentInfo(classID int) (int, int, error) {
	var result struct {
		CurrentEnrollment int
		Capacity          int
	}

	err := db.Table("program_class_enrollments").
		Select("COUNT(program_class_enrollments.id) AS current_enrollment, ps.capacity").
		Joins("JOIN program_classes ps ON program_class_enrollments.class_id = ps.id AND ps.deleted_at IS NULL").
		Where("program_class_enrollments.class_id = ?", classID).
		Group("ps.capacity").
		Find(&result).Error

	if err != nil {
		return 0, 0, err
	}

	return result.CurrentEnrollment, result.Capacity, nil
}
