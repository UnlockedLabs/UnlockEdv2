package database

import "UnlockEdv2/src/models"

func (db *DB) GetProgramSectionEnrollmentsForUser(userID, page, perPage int) (int64, []models.ProgramSectionEnrollment, error) {
	content := []models.ProgramSectionEnrollment{}
	var total int64
	tx := db.Model(&models.ProgramSectionEnrollment{}).Where("user_id = ?", userID)

	if err := tx.Count(&total).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "program section enrollments")
	}
	if err := tx.Find(&content).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "program section enrollments")
	}
	return total, content, nil
}

func (db *DB) GetProgramSectionEnrollmentForUser(sectionID, userID int) (int64, []models.ProgramSectionEnrollment, error) {
	content := []models.ProgramSectionEnrollment{}
	var total int64
	tx := db.Model(&models.ProgramSectionEnrollment{}).Where("user_id = ?", userID).Where("section_id=?", sectionID)

	if err := tx.Count(&total).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "program section enrollments")
	}
	if err := tx.Find(&content).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "program section enrollments")
	}
	return total, content, nil
}

func (db *DB) GetProgramSectionEnrollmentsByID(id int) (*models.ProgramSectionEnrollment, error) {
	content := &models.ProgramSectionEnrollment{}
	if err := db.First(content, "id = ?", id).Error; err != nil {
		return nil, newNotFoundDBError(err, "section enrollments")
	}
	return content, nil
}

func (db *DB) GetEnrollmentsForSection(page, perPage, sectionId int) (int64, []models.ProgramSectionEnrollment, error) {
	content := []models.ProgramSectionEnrollment{}
	var total int64
	tx := db.Model(&models.ProgramSectionEnrollment{}).Where("section_id = ?", sectionId)
	if err := tx.Count(&total).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "program section enrollments")
	}
	if err := tx.Find(&content).Limit(page).Offset(calcOffset(page, perPage)).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "program section enrollments")
	}
	return total, content, nil
}

func (db *DB) GetProgramSectionEnrollmentsForFacility(page, perPage int, facilityID uint) (int64, []models.ProgramSectionEnrollment, error) {
	content := []models.ProgramSectionEnrollment{}
	var total int64 //count
	tx := db.Model(&models.ProgramSectionEnrollment{}).
		Joins("JOIN program_sections ps ON program_section_enrollments.section_id = ps.id and ps.deleted_at IS NULL").
		Where("ps.facility_id = ?", facilityID)

	_ = tx.Count(&total)

	if err := tx.Limit(perPage).
		Offset(calcOffset(page, perPage)).
		Find(&content).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "program section enrollments")
	}
	return total, content, nil
}

func (db *DB) CreateProgramSectionEnrollments(sectionID, userID int) error {

	enrollment := &models.ProgramSectionEnrollment{
		SectionID:        uint(sectionID),
		UserID:           uint(userID),
		EnrollmentStatus: "Enrolled",
	}
	if err := db.Create(enrollment).Error; err != nil {
		return newCreateDBError(err, "section enrollment")
	}
	return nil
}

func (db *DB) DeleteProgramSectionEnrollments(id int) error {
	if err := db.Model(&models.ProgramSectionEnrollment{}).Delete(&models.ProgramSectionEnrollment{}, "id = ?", id).Error; err != nil {
		return newDeleteDBError(err, "section enrollment")
	}
	return nil
}

func (db *DB) UpdateProgramSectionEnrollments(content *models.ProgramSectionEnrollment) (*models.ProgramSectionEnrollment, error) {
	existing := &models.ProgramSectionEnrollment{}
	if err := db.First(existing, "id = ?", content.ID).Error; err != nil {
		return nil, newNotFoundDBError(err, "section enrollment")
	}
	models.UpdateStruct(existing, content)
	if err := db.Save(existing).Error; err != nil {
		return nil, newUpdateDBError(err, "section enrollment")
	}
	return content, nil
}

func (db *DB) GetProgramSectionEnrollmentssForProgram(page, perPage, facilityID, programID int) (int64, []models.ProgramSectionEnrollment, error) {
	content := []models.ProgramSectionEnrollment{}
	var total int64
	tx := db.Model(&models.ProgramSectionEnrollment{}).
		Joins("JOIN program_sections ps ON program_section_enrollments.section_id = ps.id and ps.deleted_at IS NULL").
		Where("ps.facility_id = ?", facilityID).
		Where("ps.program_id = ?", programID)

	if err := tx.Count(&total).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "program section enrollments")
	}
	if err := tx.Limit(perPage).
		Offset(calcOffset(page, perPage)).
		Find(&content).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "program section enrollments")
	}
	return total, content, nil
}

func (db *DB) GetProgramSectionEnrollmentsAttendance(page, perPage, id int) (int64, []models.ProgramSectionEventAttendance, error) {
	content := []models.ProgramSectionEventAttendance{}
	var total int64
	tx := db.Table("program_section_event_attendance att").
		Select("*").
		Joins("JOIN program_section_events evt ON att.event_id = evt.id and evt.deleted_at IS NULL").
		Joins("JOIN program_sections ps ON evt.section_id = ps.id and ps.deleted_at IS NULL").
		Joins("JOIN program_section_enrollments pse ON ps.id = pse.section_id and pse.deleted_at IS NULL").
		Where("pse.id = ?", id).
		Where("att.deleted_at IS NULL")

	if err := tx.Count(&total).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "section event")
	}
	if err := tx.Limit(perPage).
		Offset(calcOffset(page, perPage)).
		Find(&content).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "section event attendance")
	}
	return total, content, nil
}

func (db *DB) GetProgramSectionEnrollmentInfo(sectionID int) (int, int, error) {
	var result struct {
		CurrentEnrollment int
		Capacity          int
	}

	err := db.Table("program_section_enrollments").
		Select("COUNT(program_section_enrollments.id) AS current_enrollment, ps.capacity").
		Joins("JOIN program_sections ps ON program_section_enrollments.section_id = ps.id AND ps.deleted_at IS NULL").
		Where("program_section_enrollments.section_id = ?", sectionID).
		Group("ps.capacity").
		Find(&result).Error

	if err != nil {
		return 0, 0, err
	}

	return result.CurrentEnrollment, result.Capacity, nil
}
