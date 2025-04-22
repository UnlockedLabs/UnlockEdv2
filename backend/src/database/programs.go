package database

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/models"
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
	tx := db.WithContext(args.Ctx).Model(&models.Program{}).
		Preload("Facilities").
		Preload("Favorites", "user_id = ?", args.UserID).
		Preload("ProgramTypes").
		Preload("ProgramCreditTypes")
	if len(args.Tags) > 0 {
		tx = tx.Joins("JOIN program_types t ON t.program_id = programs.id").Where("t.id IN (?)", args.Tags)
	}

	if args.OrderBy != "" {
		tx = tx.Order(args.OrderClause())
	}

	if args.Search != "" {
		tx = tx.Where("LOWER(name) LIKE ? OR LOWER(description) LIKE ? ", args.SearchQuery(), args.SearchQuery())
	}

	if err := tx.Count(&args.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "programs")
	}
	if err := tx.Limit(args.PerPage).Offset(args.CalcOffset()).Find(&content).Error; err != nil {
		return nil, newGetRecordsDBError(err, "programs")
	}
	programs := src.IterMap(func(prog models.Program) models.Program {
		if len(prog.Favorites) > 0 {
			prog.IsFavorited = true
			return prog
		}
		return prog
	}, content)
	return programs, nil
}

func (db *DB) CreateProgram(content *models.Program, types *models.ProgramTypeInfo) error {
	err := Validate().Struct(content)
	if err != nil {
		return NewDBError(err, "create programs validation error")
	}

	if err := db.Create(content).Error; err != nil {
		return newCreateDBError(err, "programs")
	}
	for _, credit := range types.ProgramCreditTypes {
		var creditType models.ProgramCreditType
		creditType.CreditType = credit
		creditType.ProgramID = content.ID
		if err := db.Create(creditType).Error; err != nil {
			return newCreateDBError(err, "credit type")
		}
	}
	for _, programType := range types.ProgramTypes {
		var programTypes models.ProgramType
		programTypes.ProgramType = programType
		programTypes.ProgramID = content.ID
		if err := db.Create(programTypes).Error; err != nil {
			return newCreateDBError(err, "credit type")
		}
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
	if err := db.Delete(&models.Program{}, id).Error; err != nil {
		return newDeleteDBError(err, "programs")
	}
	return nil
}
