package database

import "UnlockEdv2/src/models"

func (db *DB) GetProgramSectionEnrollmentsForUser(userID, page, perPage int) (int64, []models.ProgramSectionEnrollment, error) {
	content := []models.ProgramSectionEnrollment{}
	var total int64
	if err := db.Find(&content, "user_id = ?", userID).Count(&total).Error; err != nil {
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
	if err := db.Find(&content, "section_id = ?", sectionId).Count(&total).Limit(page).Offset((page - 1) * perPage).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "program section enrollments")
	}
	return total, content, nil
}

func (db *DB) GetProgramSectionEnrollmentsForFacility(page, perPage int, facilityID uint) (int64, []models.ProgramSectionEnrollment, error) {
	content := []models.ProgramSectionEnrollment{}
	var total int64 //count
	if err := db.Table("program_section_enrollments pse").
		Select("*").
		Joins("JOIN program_sections ps ON pse.section_id = ps.id and ps.deleted_at IS NULL").
		Where("ps.facility_id = ?", facilityID).
		Where("pse.deleted_at IS NULL").
		Count(&total).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "program section enrollments")
	}
	if err := db.Table("program_section_enrollments pse").
		Select("pse.*").
		Joins("JOIN program_sections ps ON pse.section_id = ps.id and ps.deleted_at IS NULL").
		Where("ps.facility_id = ?", facilityID).
		Limit(perPage).
		Offset((page - 1) * perPage).
		Find(&content).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "program section enrollments")
	}
	return total, content, nil
}

func (db *DB) CreateProgramSectionEnrollments(sectionID, userID int) error {
	enrollment := &models.ProgramSectionEnrollment{
		SectionID: uint(sectionID),
		UserID:    uint(userID),
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
	if err := db.Table("program_section_enrollments pse").
		Select("*").
		Joins("JOIN program_sections ps ON pse.section_id = ps.id and ps.deleted_at IS NULL").
		Where("ps.facility_id = ?", facilityID).
		Where("ps.program_id = ?", programID).
		Where("pse.deleted_at IS NULL").
		Count(&total).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "program section enrollments")
	}
	if err := db.Table("program_section_enrollments pse").
		Select("pse.*").
		Joins("JOIN program_sections ps ON pse.section_id = ps.id and ps.deleted_at IS NULL").
		Where("ps.facility_id = ?", facilityID).
		Where("ps.program_id = ?", programID).
		Limit(perPage).
		Offset((page - 1) * perPage).
		Find(&content).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "program section enrollments")
	}
	return total, content, nil
}

func (db *DB) GetProgramSectionEnrollmentsAttendance(page, perPage, id int) (int64, []models.ProgramSectionEventAttendance, error) {
	content := []models.ProgramSectionEventAttendance{}
	var total int64
	if err := db.Table("program_section_event_attendance att").
		Select("*").
		Joins("JOIN program_section_events evt ON att.event_id = evt.id and evt.deleted_at IS NULL").
		Joins("JOIN program_sections ps ON evt.section_id = ps.id and ps.deleted_at IS NULL").
		Joins("JOIN program_section_enrollments pse ON ps.id = pse.section_id and pse.deleted_at IS NULL").
		Where("pse.id = ?", id).
		Where("att.deleted_at IS NULL").
		Count(&total).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "section event attendance")
	}
	if err := db.Table("program_section_event_attendance att").
		Select("att.*").
		Joins("JOIN program_section_events evt ON att.event_id = evt.id and evt.deleted_at IS NULL").
		Joins("JOIN program_sections ps ON evt.section_id = ps.id and ps.deleted_at IS NULL").
		Joins("JOIN program_section_enrollments pse ON ps.id = pse.section_id and pse.deleted_at IS NULL").
		Where("pse.id = ?", id).
		Limit(perPage).
		Offset((page - 1) * perPage).
		Find(&content).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "section event attendance")
	}
	return total, content, nil
}
