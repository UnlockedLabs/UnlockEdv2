package database

import (
	"UnlockEdv2/src/models"
)

func IsValidOrderBy(orderBy string) bool {
	validOrderFields := map[string]bool{
		"type":                 true,
		"user_id":              true,
		"username":             true,
		"course_id":            true,
		"provider_platform_id": true,
		"name":                 true,
		"description":          true,
	}
	_, ok := validOrderFields[orderBy]
	return ok
}

func (db *DB) GetMilestonesByCourseID(page, perPage, id int) (int64, []models.Milestone, error) {
	content := []models.Milestone{}
	total := int64(0)
	_ = db.Model(&models.Milestone{}).Where("course_id = ?", id).Count(&total)
	if err := db.Where("course_id = ?", id).Limit(perPage).Offset((page - 1) * perPage).Find(&content).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "milestones")
	}
	return total, content, nil
}

type MilestoneResponse struct {
	ProviderPlatformName string `json:"provider_platform_name"`
	CourseName           string `json:"course_name"`
	Username             string `json:"username"`
	Type                 string `json:"type"`
	IsCompleted          bool   `json:"is_completed"`
	ExternalID           string `json:"external_id"`
	ID                   int    `json:"id"`
	CourseID             int    `json:"course_id"`
}

func (db *DB) GetMilestones(page, perPage int, search, orderBy string) (int64, []MilestoneResponse, error) {
	var (
		content []MilestoneResponse
		total   int64
	)
	query := db.Model(&models.Milestone{}).Select("milestones.*, provider_platforms.name as provider_platform_name, courses.name as course_name, users.username").
		Joins("JOIN courses ON milestones.course_id = courses.id").
		Joins("JOIN provider_platforms ON courses.provider_platform_id = provider_platforms.id").
		Joins("JOIN users ON milestones.user_id = users.id")

	if search != "" {
		search = "%" + search + "%"
		query = query.Where("milestones.type ILIKE ?", search).Or("users.username ILIKE ?", search).Or("courses.name ILIKE ?", search).Or("provider_platforms.name ILIKE ?", search)
	}
	if err := query.Count(&total).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "milestones")
	}

	if orderBy != "" && IsValidOrderBy(orderBy) {
		query = query.Order(orderBy)
	}

	query = query.Limit(perPage).Offset((page - 1) * perPage)

	if err := query.Find(&content).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "milestones")
	}
	return total, content, nil
}

func (db *DB) GetMilestonesForUser(page, perPage int, id uint) (int64, []MilestoneResponse, error) {
	content := []MilestoneResponse{}
	total := int64(0)
	err := db.Model(&models.Milestone{}).Select("milestones.*, provider_platforms.name as provider_platform_name, courses.name as course_name, users.username").
		Joins("JOIN courses ON milestones.course_id = courses.id").
		Joins("JOIN provider_platforms ON courses.provider_platform_id = provider_platforms.id").
		Joins("JOIN users ON milestones.user_id = users.id").
		Where("user_id = ?", id).
		Count(&total).
		Limit(perPage).
		Offset((page - 1) * perPage).
		Find(&content).
		Error
	if err != nil {
		return 0, nil, NewDBError(err, "error getting milestones for user")
	}
	return total, content, nil
}

func (db *DB) CreateMilestone(content *models.Milestone) (*models.Milestone, error) {
	if err := db.Create(content).Error; err != nil {
		return nil, newCreateDBError(err, "milestones")
	}
	return content, nil
}

func (db *DB) UpdateMilestone(content *models.Milestone) (*models.Milestone, error) {
	if err := db.Save(content).Error; err != nil {
		return nil, newUpdateDBrror(err, "milestones")
	}
	return content, nil
}

func (db *DB) DeleteMilestone(id int) error {
	if err := db.Where("id = ?", id).Delete(&models.Milestone{}).Error; err != nil {
		return newDeleteDBError(err, "milestones")
	}
	return nil
}

func (db *DB) GetMilestoneByID(id int) (*models.Milestone, error) {
	content := &models.Milestone{}
	if err := db.Where("id = ?", id).First(content).Error; err != nil {
		return nil, newNotFoundDBError(err, "milestones")
	}
	return content, nil
}
