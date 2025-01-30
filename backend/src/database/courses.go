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

func (db *DB) GetCourses(args *models.QueryContext) ([]models.Course, error) {
	content := make([]models.Course, 0, args.PerPage)
	total := int64(0)
	if args.Search != "" {
		search := "%" + args.Search + "%"
		tx := db.Model(&models.Course{}).
			Where("LOWER(courses.name) LIKE ?", search).
			Or("LOWER(courses.alt_name) LIKE ?", search).
			Or("LOWER(provider_platforms.name) LIKE ?", search).
			Joins("LEFT JOIN provider_platforms ON courses.provider_platform_id = provider_platforms.id")

		if err := tx.Count(&args.Total).Error; err != nil {
			return nil, newNotFoundDBError(err, "courses")
		}

		if err := tx.Limit(args.PerPage).Offset(args.CalcOffset()).Find(&content).Error; err != nil {
			return nil, newNotFoundDBError(err, "courses")
		}
	} else {
		tx := db.Model(&models.Course{})
		if err := tx.Count(&total).Error; err != nil {
			return nil, newNotFoundDBError(err, "courses")
		}
		if err := tx.Limit(args.PerPage).Offset(args.CalcOffset()).Find(&content).Error; err != nil {
			return nil, err
		}
	}
	return content, nil
}
