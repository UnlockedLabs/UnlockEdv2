package database

import (
	"UnlockEdv2/src/models"
)

func (db *DB) GetClassByID(id int) (*models.ProgramClass, error) {
	content := &models.ProgramClass{}
	if err := db.First(content, "id = ?", id).Error; err != nil {
		return nil, newNotFoundDBError(err, "program classes")
	}
	return content, nil
}

func (db *DB) GetClassesForFacility(args *models.QueryContext) ([]models.ProgramClass, error) {
	content := []models.ProgramClass{}
	tx := db.WithContext(args.Ctx).Find(&content, "facility_id = ?", args.FacilityID)
	if args.Search != "" {
		tx = tx.Where("LOWER(name) LIKE ?", args.SearchQuery())
	}
	if err := tx.Count(&args.Total).Limit(args.PerPage).Offset(args.CalcOffset()).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program classes")
	}
	return content, nil
}

func (db *DB) CreateProgramClass(content *models.ProgramClass) (*models.ProgramClass, error) {
	err := Validate().Struct(content)
	if err != nil {
		return nil, newCreateDBError(err, "create program classes validation error")
	}
	if err := db.Create(content).Error; err != nil {
		return nil, newCreateDBError(err, "program classes")
	}
	return content, nil
}

func (db *DB) UpdateProgramClass(content *models.ProgramClass, ids []int) (*models.ProgramClass, error) {
	if err := db.Model(&models.ProgramClass{}).Where("id IN ?", ids).Updates(content).Error; err != nil {
		return nil, newUpdateDBError(err, "program classes")
	}
	return content, nil
}

func (db *DB) GetProgramClassDetailsByID(id int, args *models.QueryContext) ([]models.ProgramClassDetail, error) {
	var classDetails []models.ProgramClassDetail
	query := db.WithContext(args.Ctx).Table("program_classes ps").
		Select(`ps.*,
		fac.name as facility_name,
		count(pse.id) as enrolled
		`).
		Joins(`join facilities fac on fac.id = ps.facility_id
			AND fac.deleted_at IS NULL`).
		Joins(`left outer join program_class_enrollments pse on pse.class_id = ps.id 
			and enrollment_status = 'Enrolled'`). //TODO Enrolled may change here
		Where(`ps.program_id = ? 
			and ps.facility_id = ?`, id, args.FacilityID).
		Group("ps.id,fac.name")
	if err := query.Count(&args.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "programs")
	}
	if err := query.Limit(args.PerPage).Offset(args.CalcOffset()).Order(args.OrderClause()).Find(&classDetails).Error; err != nil {
		return nil, newGetRecordsDBError(err, "programs")
	}
	return classDetails, nil
}
