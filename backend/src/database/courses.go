package database

import (
	"UnlockEdv2/src/models"
)

func (db *DB) GetCourseByID(id int) (*models.Course, error) {
	content := &models.Course{}
	if err := db.First(content, id).Error; err != nil {
		return nil, err
	}
	return content, nil
}

func (db *DB) GetCourse(page, perPage int, search string) (int64, []models.Course, error) {
	content := make([]models.Course, 0, perPage)
	total := int64(0)
	if search != "" {
		search = "%" + search + "%"
		tx := db.Model(&models.Course{}).
			Where("LOWER(courses.name) LIKE ?", search).
			Or("LOWER(courses.alt_name) LIKE ?", search).
			Or("LOWER(provider_platforms.name) LIKE ?", search).
			Joins("LEFT JOIN provider_platforms ON courses.provider_platform_id = provider_platforms.id")

		if err := tx.Count(&total).Error; err != nil {
			return 0, nil, newNotFoundDBError(err, "courses")
		}

		if err := tx.Limit(perPage).Offset(calcOffset(page, perPage)).Find(&content).Error; err != nil {
			return 0, nil, newNotFoundDBError(err, "courses")
		}
	} else {
		tx := db.Model(&models.Course{})
		if err := tx.Count(&total).Error; err != nil {
			return 0, nil, newNotFoundDBError(err, "courses")
		}
		if err := tx.Limit(perPage).Offset(calcOffset(page, perPage)).Find(&content).Error; err != nil {
			return 0, nil, err
		}
	}
	return total, content, nil
}
