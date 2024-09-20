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

func (db *DB) GetProgram(page, perPage int, search string) (int64, []models.Program, error) {
	content := []models.Program{}
	total := int64(0)
	if search != "" { //count block
		// search by program name, alt name or provider platform name (provider_platforms.id = programs.provider_platform_id)--just counts records
		search = "%" + strings.ToLower(search) + "%"
		if db.Dialector.Name() == "sqlite" {
			_ = db.Model(&models.Program{}).Where("LOWER(programs.name) LIKE ?", search).Or("LOWER(programs.alt_name) LIKE ?", search).
				Or("LOWER(provider_platforms.name) LIKE ?", search).Joins("LEFT JOIN provider_platforms ON programs.provider_platform_id = provider_platforms.id").Count(&total)
		} else {
			_ = db.Model(&models.Program{}).Where("programs.name ILIKE ?", search).Or("programs.alt_name ILIKE ?", search).
				Or("provider_platforms.name ILIKE ?", search).Joins("LEFT JOIN provider_platforms ON programs.provider_platform_id = provider_platforms.id").Count(&total)
		}
	} else {
		_ = db.Model(&models.Program{}).Count(&total)
	}

	var err error
	if search != "" { //retieve block
		if db.Dialector.Name() == "sqlite" {
			err = db.Limit(perPage).Offset((page-1)*perPage).Model(&models.Program{}).
				Where("LOWER(programs.name) LIKE ?", search).Or("LOWER(programs.alt_name) LIKE ?", search).
				Or("LOWER(provider_platforms.name) LIKE ?", search).
				Joins("LEFT JOIN provider_platforms ON programs.provider_platform_id = provider_platforms.id").
				Find(&content).Error
		} else {
			err = db.Model(&models.Program{}).
				Where("programs.name ILIKE ?", search).Or("programs.alt_name ILIKE ?", search).
				Or("provider_platforms.name ILIKE ?", search).
				Joins("LEFT JOIN provider_platforms ON programs.provider_platform_id = provider_platforms.id").
				Find(&content).Error
		}
	} else {
		err = db.Limit(perPage).Offset((page - 1) * perPage).Find(&content).Error
	}
	if err != nil {
		return 0, nil, newGetRecordsDBError(err, "programs")
	}
	return total, content, nil
}

func (db *DB) CreateProgram(content *models.Program) (*models.Program, error) {
	if err := db.Create(content).Error; err != nil {
		return nil, newCreateDBError(err, "programs")
	}
	return content, nil
}

func (db *DB) UpdateProgram(content *models.Program) (*models.Program, error) {
	if err := db.Save(content).Error; err != nil {
		return nil, newUpdateDBrror(err, "programs")
	}
	return content, nil
}

func (db *DB) DeleteProgram(id int) error {
	if err := db.Delete(&models.Program{}, id).Error; err != nil {
		return newDeleteDBError(err, "programs")
	}
	return nil
}
