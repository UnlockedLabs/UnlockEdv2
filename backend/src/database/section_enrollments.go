package database

import "UnlockEdv2/src/models"

func (db *DB) GetProgramSectionEnrollmentssForUser(userID, page, perPage int) (int64, []models.ProgramSectionEnrollment, error) {
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

func (db *DB) GetProgramSectionEnrollmentssForFacility(page, perPage int, facilityID uint) (int64, []models.ProgramSectionEnrollment, error) {
	content := []models.ProgramSectionEnrollment{}
	var total int64
	if err := db.Find(&content, "facility_id = ?", facilityID).Count(&total).Limit(page).Offset((page - 1) * perPage).Error; err != nil {
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
	if err := db.Find(&content, "facility_id = ? AND program_id = ?", facilityID, programID).
		Count(&total).Limit(page).Offset((page - 1) * perPage).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "program section enrollments")
	}
	return total, content, nil
}

func (db *DB) GetProgramSectionEnrollmentsAttendance(page, perPage, id int) (int64, []models.ProgramSectionEventAttendance, error) {
	content := []models.ProgramSectionEventAttendance{}
	var total int64
	if err := db.Find(&content, "section_enrollment_id = ?", id).
		Count(&total).Limit(page).Offset((page - 1) * perPage).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "section event attendance")
	}
	return total, content, nil
}
