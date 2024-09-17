package database

import "UnlockEdv2/src/models"

func (db *DB) GetSectionEnrollmentsForUser(userID, page, perPage int) (int64, []models.SectionEnrollment, error) {
	content := []models.SectionEnrollment{}
	var total int64
	if err := db.Find(&content, "user_id = ?", userID).Count(&total).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "section enrollments")
	}
	return total, content, nil
}

func (db *DB) GetSectionEnrollmentByID(id int) (*models.SectionEnrollment, error) {
	content := &models.SectionEnrollment{}
	if err := db.First(content, "id = ?", id).Error; err != nil {
		return nil, newNotFoundDBError(err, "section enrollments")
	}
	return content, nil
}

func (db *DB) GetEnrollmentsForSection(page, perPage, sectionId int) (int64, []models.SectionEnrollment, error) {
	content := []models.SectionEnrollment{}
	var total int64
	if err := db.Find(&content, "section_id = ?", sectionId).Count(&total).Limit(page).Offset((page - 1) * perPage).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "section enrollments")
	}
	return total, content, nil
}

func (db *DB) GetSectionEnrollmentsForFacility(page, perPage int, facilityID uint) (int64, []models.SectionEnrollment, error) {
	content := []models.SectionEnrollment{}
	var total int64
	if err := db.Find(&content, "facility_id = ?", facilityID).Count(&total).Limit(page).Offset((page - 1) * perPage).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "section enrollments")
	}
	return total, content, nil
}

func (db *DB) CreateSectionEnrollment(sectionID, userID int) error {
	enrollment := &models.SectionEnrollment{
		SectionID: uint(sectionID),
		UserID:    uint(userID),
	}
	if err := db.Create(enrollment).Error; err != nil {
		return newCreateDBError(err, "section enrollment")
	}
	return nil
}

func (db *DB) DeleteSectionEnrollment(id int) error {
	if err := db.Model(&models.SectionEnrollment{}).Delete(&models.SectionEnrollment{}, "id = ?", id).Error; err != nil {
		return newDeleteDBError(err, "section enrollment")
	}
	return nil
}

func (db *DB) UpdateSectionEnrollment(content *models.SectionEnrollment) (*models.SectionEnrollment, error) {
	existing := &models.SectionEnrollment{}
	if err := db.First(existing, "id = ?", content.ID).Error; err != nil {
		return nil, newNotFoundDBError(err, "section enrollment")
	}
	models.UpdateStruct(existing, content)
	if err := db.Save(existing).Error; err != nil {
		return nil, newUpdateDBError(err, "section enrollment")
	}
	return content, nil
}

func (db *DB) GetSectionEnrollmentsForProgram(page, perPage, facilityID, programID int) (int64, []models.SectionEnrollment, error) {
	content := []models.SectionEnrollment{}
	var total int64
	if err := db.Find(&content, "facility_id = ? AND program_id = ?", facilityID, programID).
		Count(&total).Limit(page).Offset((page - 1) * perPage).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "section enrollments")
	}
	return total, content, nil
}

func (db *DB) GetSectionEnrollmentAttendance(page, perPage, id int) (int64, []models.SectionEventAttendance, error) {
	content := []models.SectionEventAttendance{}
	var total int64
	if err := db.Find(&content, "section_enrollment_id = ?", id).
		Count(&total).Limit(page).Offset((page - 1) * perPage).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "section event attendance")
	}
	return total, content, nil
}
