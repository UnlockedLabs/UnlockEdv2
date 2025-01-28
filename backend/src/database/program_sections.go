package database

import "UnlockEdv2/src/models"

func (db *DB) GetSectionsForProgram(id int, args *models.QueryContext) ([]models.ProgramSection, error) {
	content := []models.ProgramSection{}
	if err := db.Find(&content, "program_id = ?", id).Preload("Events").Count(&args.Total).Error; err != nil {
		return nil, newNotFoundDBError(err, "programs")
	}
	return content, nil
}

func (db *DB) GetSectionByID(id int) (*models.ProgramSection, error) {
	content := &models.ProgramSection{}
	if err := db.First(content, "id = ?", id).Error; err != nil {
		return nil, newNotFoundDBError(err, "program sections")
	}
	return content, nil
}

func (db *DB) GetSectionsForFacility(args *models.QueryContext) ([]models.ProgramSection, error) {
	content := []models.ProgramSection{}
	tx := db.Find(&content, "facility_id = ?", args.FacilityID)
	if args.Search != "" {
		tx = tx.Where("name LIKE ?", "%"+args.Search+"%")
	}
	if err := tx.Count(&args.Total).Limit(args.PerPage).Offset(args.CalcOffset()).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program sections")
	}
	return content, nil
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
