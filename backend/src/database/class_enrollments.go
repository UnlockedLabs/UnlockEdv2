package database

import "UnlockEdv2/src/models"

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

func (db *DB) CreateProgramClassEnrollments(classID int, userIDs []int) error {
	enrollments := make([]models.ProgramClassEnrollment, len(userIDs))
	for i := range userIDs {
		enrollments = append(enrollments, models.ProgramClassEnrollment{
			ClassID:          uint(classID),
			UserID:           uint(userIDs[i]),
			EnrollmentStatus: "Enrolled",
		})
	}
	if err := db.Create(enrollments).Error; err != nil {
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

func (db *DB) UpdateProgramClassEnrollments(content *models.ProgramClassEnrollment) (*models.ProgramClassEnrollment, error) {
	existing := &models.ProgramClassEnrollment{}
	if err := db.First(existing, "id = ?", content.ID).Error; err != nil {
		return nil, newNotFoundDBError(err, "class enrollment")
	}
	models.UpdateStruct(existing, content)
	if err := db.Save(existing).Error; err != nil {
		return nil, newUpdateDBError(err, "class enrollment")
	}
	return content, nil
}

func (db *DB) GetProgramClassEnrollmentsForProgram(args *models.QueryContext, progId int) ([]models.ProgramClassEnrollment, error) {
	content := []models.ProgramClassEnrollment{}
	tx := db.WithContext(args.Ctx).Model(&models.ProgramClassEnrollment{}).
		Joins("JOIN program_classes ps ON program_class_enrollments.class_id = ps.id and ps.deleted_at IS NULL").
		Where("ps.facility_id = ?", args.FacilityID).
		Where("ps.program_id = ?", progId)

	if err := tx.Count(&args.Total).Error; err != nil {
		return nil, newNotFoundDBError(err, "program class enrollments")
	}
	if err := tx.Limit(args.PerPage).
		Offset(args.CalcOffset()).
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
