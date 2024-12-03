package database

import (
	"UnlockEdv2/src/models"
)

func (db *DB) GetProgramByID(id int) (*models.Program, error) {
	content := &models.Program{}
	if err := db.First(content, id).Error; err != nil {
		return nil, newNotFoundDBError(err, "programs")
	}
	return content, nil
}

func (db *DB) GetProgram(page, perPage int, tags []string, search string, userId uint) (int64, []models.Program, error) {
	content := make([]models.Program, 0, perPage)
	total := int64(0)
	if len(tags) > 0 {
		// look in program_tags for programs matching this tag
		query := db.Model(&models.ProgramTag{}).Select("program_id")
		for idx, tag := range tags {
			if idx == 0 {
				query.Where("value = ?", tag)
			} else {
				query.Or("value = ?", tag)
			}
		}

		tx := db.Model(&models.Program{}).Preload("Tags").Preload("Facilities").Preload("Favorites", "user_id = ?", userId).Find(&content, "id IN (?)", query)
		if search != "" {
			tx = tx.Where("name LIKE ?", "%"+search+"%")
		}
		if err := tx.Count(&total).Error; err != nil {
			return 0, nil, newGetRecordsDBError(err, "programs")
		}
		if err := tx.Limit(perPage).Offset(calcOffset(page, perPage)).Error; err != nil {
			return 0, nil, newGetRecordsDBError(err, "programs")
		}
	} else {
		tx := db.Model(&models.Program{}).
			Preload("Tags").
			Preload("Facilities").
			Preload("Favorites", "user_id = ?", userId)
		if search != "" {
			tx = tx.Where("name LIKE ?", "%"+search+"%").Count(&total)
		}
		if err := tx.Count(&total).Error; err != nil {
			return 0, nil, newGetRecordsDBError(err, "programs")
		}
		if err := tx.Limit(perPage).Offset(calcOffset(page, perPage)).Find(&content).Error; err != nil {
			return 0, nil, newGetRecordsDBError(err, "programs")
		}
	}
	programs := iterMap(func(prog models.Program) models.Program {
		if len(prog.Favorites) > 0 {
			prog.IsFavorited = true
			return prog
		}
		return prog
	}, content)
	return total, programs, nil
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
