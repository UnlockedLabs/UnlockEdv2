package database

import (
	"UnlockEdv2/src/models"
	"fmt"
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
	if len(args.Tags) > 0 {
		fmt.Println("tags", args.Tags)
		// look in program_tags for programs matching this tag
		query := db.Model(&models.ProgramTag{}).Select("program_id")
		for idx, tag := range args.Tags {
			if idx == 0 {
				query.Where("value = ?", tag)
			} else {
				query.Or("value = ?", tag)
			}
		}

		tx := db.Model(&models.Program{}).Preload("Tags").Preload("Facilities").Preload("Favorites", "user_id = ?", args.UserID).
			Find(&content, "id IN (?)", query)
		if args.Search != "" {
			tx = tx.Where("name LIKE ?", "%"+args.Search+"%")
		}
		if err := tx.Count(&args.Total).Error; err != nil {
			return nil, newGetRecordsDBError(err, "programs")
		}
		if err := tx.Limit(args.PerPage).Offset(args.CalcOffset()).Error; err != nil {
			return nil, newGetRecordsDBError(err, "programs")
		}
	} else {
		tx := db.Model(&models.Program{}).
			Preload("Tags").
			Preload("Facilities").
			Preload("Favorites", "user_id = ?", args.UserID)
		if args.Search != "" {
			tx = tx.Where("name LIKE ?", "%"+args.Search+"%")
		}
		if err := tx.Count(&args.Total).Error; err != nil {
			return nil, newGetRecordsDBError(err, "programs")
		}
		if err := tx.Limit(args.PerPage).Offset(args.CalcOffset()).Find(&content).Error; err != nil {
			return nil, newGetRecordsDBError(err, "programs")
		}
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

func (db *DB) TagProgram(id int, tag string) error {
	program := &models.Program{}
	if err := db.First(program, id).Error; err != nil {
		return newNotFoundDBError(err, "programs")
	}
	if err := db.Create(&models.ProgramTag{ProgramID: uint(id), Value: tag}).Error; err != nil {
		return newCreateDBError(err, "program tags")
	}
	return nil
}

func (db *DB) UntagProgram(id int, tag string) error {
	program := &models.Program{}
	if err := db.First(program, id).Error; err != nil {
		return newNotFoundDBError(err, "programs")
	}
	if err := db.Delete(&models.ProgramTag{ProgramID: uint(id), Value: tag}).Error; err != nil {
		return newDeleteDBError(err, "program tags")
	}
	return nil
}
