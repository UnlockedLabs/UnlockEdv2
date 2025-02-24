package database

import (
	"UnlockEdv2/src/models"
	"strings"
)

func (db *DB) GetProgramByID(id int) (*models.Program, error) {
	content := &models.Program{}
	if err := db.First(content, id).Error; err != nil {
		return nil, newNotFoundDBError(err, "programs")
	}
	return content, nil
}

func (db *DB) GetPrograms(args *models.QueryContext) ([]models.Program, error) {
	content := make([]models.Program, 0, args.PerPage)
	tx := db.Model(&models.Program{}).
		Preload("Facilities").
		Preload("Favorites", "user_id = ?", args.UserID)
	if len(args.Tags) > 0 {
		tx = tx.Joins("JOIN program_tags t ON t.program_id = programs.id").Where("t.tag_id IN (?) AND t.facility_id = ?", args.Tags, args.FacilityID)
	}
	if args.OrderBy != "" && args.Order != "" {
		tx = tx.Order(args.OrderBy + " " + args.Order)
	}
	if args.Search != "" {
		search := "%" + strings.ToLower(args.Search) + "%"
		tx = tx.Where("LOWER(name) LIKE ? OR LOWER(description) LIKE ? ", search, search)
	}
	if err := tx.Count(&args.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "programs")
	}
	if err := tx.Limit(args.PerPage).Offset(args.CalcOffset()).Find(&content).Error; err != nil {
		return nil, newGetRecordsDBError(err, "programs")
	}
	programs := iterMap(func(prog models.Program) models.Program {
		if len(prog.Favorites) > 0 {
			prog.IsFavorited = true
			return prog
		}
		return prog
	}, content)
	return programs, nil
}

func (db *DB) CreateProgram(content *models.Program) error {
	err := Validate().Struct(content)
	if err != nil {
		return NewDBError(err, "create programs validation error")
	}
	if err := db.Create(content).Error; err != nil {
		return newCreateDBError(err, "programs")
	}
	return nil
}

func (db *DB) UpdateProgram(content *models.Program) (*models.Program, error) {
	if err := db.Save(content).Error; err != nil {
		return nil, newUpdateDBError(err, "programs")
	}
	return content, nil
}

func (db *DB) DeleteProgram(id int) error {
	if err := db.Debug().Delete(&models.Program{}, id).Error; err != nil {
		return newDeleteDBError(err, "programs")
	}
	return nil
}
