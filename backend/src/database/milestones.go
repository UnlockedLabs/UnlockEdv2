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
	if err := db.Where("course_id = ?", id).Limit(perPage).Offset(calcOffset(page, perPage)).Find(&content).Error; err != nil {
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

func (db *DB) GetMilestones(args *models.QueryContext) ([]MilestoneResponse, error) {
	var content []MilestoneResponse
	query := db.Model(&models.Milestone{}).Select("milestones.*, provider_platforms.name as provider_platform_name, courses.name as course_name, users.username").
		Joins("JOIN courses ON milestones.course_id = courses.id").
		Joins("JOIN provider_platforms ON courses.provider_platform_id = provider_platforms.id").
		Joins("JOIN users ON milestones.user_id = users.id")
	var search string
	if args.Search != "" {
		search = "%" + args.Search + "%"
		query = query.Where("LOWER(milestones.type) LIKE ?", search).Or("LOWER(users.username) LIKE ?", search).Or("LOWER(courses.name) LIKE ?", search).Or("LOWER(provider_platforms.name) LIKE ?", search)
	}
	if err := query.Count(&args.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "milestones")
	}
	if args.OrderBy != "" && IsValidOrderBy(args.OrderBy) {
		if args.OrderBy == "name" {
			args.OrderBy = "courses.name"
		}
		query = query.Order(args.OrderBy)
	}
	query = query.Limit(args.PerPage).Offset(args.CalcOffset())
	if err := query.Find(&content).Error; err != nil {
		return nil, newGetRecordsDBError(err, "milestones")
	}
	return content, nil
}

func (db *DB) GetMilestonesForUser(args *models.QueryContext) ([]MilestoneResponse, error) {
	content := []MilestoneResponse{}
	err := db.Model(&models.Milestone{}).Select("milestones.*, provider_platforms.name as provider_platform_name, courses.name as course_name, users.username").
		Joins("JOIN courses ON milestones.course_id = courses.id").
		Joins("JOIN provider_platforms ON courses.provider_platform_id = provider_platforms.id").
		Joins("JOIN users ON milestones.user_id = users.id").
		Where("user_id = ?", args.UserID).
		Count(&args.Total).
		Limit(args.PerPage).
		Offset(args.CalcOffset()).
		Find(&content).
		Error
	if err != nil {
		return nil, NewDBError(err, "error getting milestones for user")
	}
	return content, nil
}

func (db *DB) CreateMilestone(content *models.Milestone) (*models.Milestone, error) {
	if err := db.Create(content).Error; err != nil {
		return nil, newCreateDBError(err, "milestones")
	}
	return content, nil
}

func (db *DB) UpdateMilestone(content *models.Milestone) (*models.Milestone, error) {
	if err := db.Save(content).Error; err != nil {
		return nil, newUpdateDBError(err, "milestones")
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
