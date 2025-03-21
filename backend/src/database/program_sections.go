package database

import (
	"UnlockEdv2/src/models"
)

func (db *DB) GetSectionsForProgram(id int, args *models.QueryContext) ([]models.ProgramSection, error) {
	content := []models.ProgramSection{}
	if err := db.WithContext(args.Ctx).Preload("Events").Preload("Facility").Find(&content, "program_id = ?", id).Count(&args.Total).Error; err != nil {
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
	tx := db.WithContext(args.Ctx).Find(&content, "facility_id = ?", args.FacilityID)
	if args.Search != "" {
		tx = tx.Where("LOWER(name) LIKE ?", args.SearchQuery())
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

func (db *DB) UpdateProgramSection(content *models.ProgramSection, ids []int) (*models.ProgramSection, error) {
	if err := db.Model(&models.ProgramSection{}).Where("id IN ?", ids).Updates(content).Error; err != nil {
		return nil, newUpdateDBError(err, "program sections")
	}
	return content, nil
}

func (db *DB) GetProgramSectionDetailsByID(id int, args *models.QueryContext) ([]models.ProgramSectionDetail, error) {
	var sectionDetails []models.ProgramSectionDetail
	query := db.WithContext(args.Ctx).Table("program_sections ps").
		Select(`ps.id,
		fac.name as facility_name,
		ps.instructor_name,
		ps.start_dt,
		ps.end_dt,
		ps.capacity,
		count(pse.id) as enrolled
		`).
		Joins(`join facilities fac on fac.id = ps.facility_id
			AND fac.deleted_at IS NULL`).
		Joins(`left outer join program_section_enrollments pse on pse.section_id = ps.id 
			and enrollment_status = 'Enrolled'`). //TODO Enrolled may change here
		Where(`ps.program_id = ? 
			and ps.facility_id = ?`, id, args.FacilityID).
		Group("ps.id,fac.name,ps.instructor_name,ps.start_dt,ps.end_dt,ps.capacity")
	if err := query.Count(&args.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "programs")
	}
	query.Order("ps.start_dt desc")
	if err := query.Limit(args.PerPage).Offset(args.CalcOffset()).Find(&sectionDetails).Error; err != nil {
		return nil, newGetRecordsDBError(err, "programs")
	}
	return sectionDetails, nil
}
