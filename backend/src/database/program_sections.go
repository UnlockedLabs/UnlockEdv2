package database

import "UnlockEdv2/src/models"

func (db *DB) GetSectionsForProgram(id, page, perPage int) (int64, []models.ProgramSection, error) {
	content := []models.ProgramSection{}
	var total int64
	if err := db.Find(&content, "program_id = ?", id).Preload("Events").Count(&total).Error; err != nil {
		return 0, nil, newNotFoundDBError(err, "programs")
	}
	return total, content, nil
}

func (db *DB) GetSectionByID(id int) (*models.ProgramSection, error) {
	content := &models.ProgramSection{}
	if err := db.First(content, "id = ?", id).Error; err != nil {
		return nil, newNotFoundDBError(err, "program sections")
	}
	return content, nil
}

func (db *DB) GetSectionsForFacility(page, perPage int, facilityId uint, search string) (int64, []models.ProgramSection, error) {
	content := []models.ProgramSection{}
	var total int64
	tx := db.Find(&content, "facility_id = ?", facilityId)
	if search != "" {
		tx = tx.Where("name LIKE ?", "%"+search+"%")
	}
	if err := tx.Count(&total).Limit(perPage).Offset((page - 1) * perPage).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "program sections")
	}
	return total, content, nil
}

func (db *DB) CreateProgramSection(content *models.ProgramSection) (*models.ProgramSection, error) {
	err := Validate().Struct(content)
	if err != nil {
		return nil, newCreateDBError(err, "create program sections validation error")
	}
	if err := db.Create(content).Error; err != nil {
		return nil, newCreateDBError(err, "program sections")
	}
	return content, nil
}

func (db *DB) UpdateProgramSection(content *models.ProgramSection, id int) (*models.ProgramSection, error) {
	existing := &models.ProgramSection{}
	if err := db.First(existing, "id = ?", id).Error; err != nil {
		return nil, newNotFoundDBError(err, "program sections")
	}
	models.UpdateStruct(existing, content)
	if err := db.Save(content).Error; err != nil {
		return nil, newUpdateDBError(err, "program sections")
	}
	return content, nil
}

func (db *DB) DeleteProgramSection(id int) error {
	if err := db.Model(&models.ProgramSection{}).Delete(&models.ProgramSection{}, "id = ?", id).Error; err != nil {
		return newDeleteDBError(err, "program sections")
	}
	return nil
}
