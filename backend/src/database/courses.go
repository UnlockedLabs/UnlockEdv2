package database

import (
	"UnlockEdv2/src/models"
	"strings"
)

func (db *DB) GetCourseByID(id int) (*models.Course, error) {
	content := &models.Course{}
	if err := db.First(content, id).Error; err != nil {
		return nil, err
	}
	return content, nil
}

func (db *DB) GetCourse(page, perPage int, search string) (int64, []models.Course, error) {
	content := []models.Course{}
	total := int64(0)
	if search != "" {
		// search by course name, alt name or provider platform name (provider_platforms.id = courses.provider_platform_id)
		search = "%" + search + "%"
		if db.Dialector.Name() == "sqlite" { //count
			search = strings.ToLower(search)
			if err := db.Model(&models.Course{}).Where("LOWER(courses.name) LIKE ?", search).Or("LOWER(courses.alt_name) LIKE ?", search).
				Or("LOWER(provider_platforms.name) LIKE ?", search).Joins("LEFT JOIN provider_platforms ON courses.provider_platform_id = provider_platforms.id").Count(&total).Error; err != nil {
				return 0, nil, newNotFoundDBError(err, "courses")
			}
			if err := db.Model(&models.Course{}).Where("LOWER(courses.name) LIKE ?", search).Or("LOWER(courses.alt_name) LIKE ?", search).
				Or("LOWER(provider_platforms.name) LIKE ?", search).Joins("LEFT JOIN provider_platforms ON courses.provider_platform_id = provider_platforms.id").
				Limit(perPage).
				Offset((page - 1) * perPage).
				Find(&content).Error; err != nil {
				return 0, nil, newNotFoundDBError(err, "courses")
			}
		} else { //count
			if err := db.Model(&models.Course{}).Where("courses.name ILIKE ?", search).Or("courses.alt_name ILIKE ?", search).
				Or("provider_platforms.name ILIKE ?", search).Joins("LEFT JOIN provider_platforms ON courses.provider_platform_id = provider_platforms.id").Count(&total).Error; err != nil {
				return 0, nil, newNotFoundDBError(err, "courses")
			}
			if err := db.Model(&models.Course{}).Where("courses.name ILIKE ?", search).Or("courses.alt_name ILIKE ?", search).
				Or("provider_platforms.name ILIKE ?", search).Joins("LEFT JOIN provider_platforms ON courses.provider_platform_id = provider_platforms.id").
				Limit(perPage).
				Offset((page - 1) * perPage).
				Find(&content).Error; err != nil {
				return 0, nil, newNotFoundDBError(err, "courses")
			}
		}
	} else {
		_ = db.Model(&models.Course{}).Count(&total)
		if err := db.Limit(perPage).Offset((page - 1) * perPage).Find(&content).Error; err != nil {
			return 0, nil, err
		}
	}
	return total, content, nil
}

func (db *DB) CreateCourse(content *models.Course) (*models.Course, error) {
	if err := db.Create(content).Error; err != nil {
		return nil, err
	}
	return content, nil
}

func (db *DB) UpdateCourse(content *models.Course) (*models.Course, error) {
	if err := db.Save(content).Error; err != nil {
		return nil, err
	}
	return content, nil
}

func (db *DB) DeleteCourse(id int) error {
	if err := db.Delete(&models.Course{}, id).Error; err != nil {
		return err
	}
	return nil
}

func (db *DB) GetCourseByProviderPlatformID(id int) ([]models.Course, error) {
	content := []models.Course{}
	if err := db.Where("provider_platform_id = ?", id).Find(&content).Error; err != nil {
		return nil, err
	}
	return content, nil
}
