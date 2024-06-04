package database

import (
	"UnlockEdv2/src/models"
)

func IsValidOrderBy(orderBy string) bool {
	validOrderFields := map[string]bool{
		"type":                 true,
		"user_id":              true,
		"username":             true,
		"program_id":           true,
		"provider_platform_id": true,
		"name":                 true,
		"description":          true,
	}
	_, ok := validOrderFields[orderBy]
	return ok
}

func (db *DB) GetMilestonesByProgramID(page, perPage, id int) (int64, []models.Milestone, error) {
	content := []models.Milestone{}
	total := int64(0)
	_ = db.Conn.Model(&models.Milestone{}).Where("program_id = ?", id).Count(&total)
	if err := db.Conn.Where("program_id = ?", id).Limit(perPage).Offset((page - 1) * perPage).Find(&content).Error; err != nil {
		return 0, nil, err
	}
	return total, content, nil
}

type MilestoneResponse struct {
	ProviderPlatformName string `json:"provider_platform_name"`
	ProgramName          string `json:"program_name"`
	Username             string `json:"username"`
	Type                 string `json:"type"`
	IsCompleted          bool   `json:"is_completed"`
	ExternalID           string `json:"external_id"`
	ID                   int    `json:"id"`
	ProgramID            int    `json:"program_id"`
}

func (db *DB) GetMilestones(page, perPage int, search, orderBy string) (int64, []MilestoneResponse, error) {
	var (
		content []MilestoneResponse
		total   int64
	)
	query := db.Conn.Model(&models.Milestone{}).Select("milestones.*, provider_platforms.name as provider_platform_name, programs.name as program_name, users.username").
		Joins("JOIN programs ON milestones.program_id = programs.id").
		Joins("JOIN provider_platforms ON programs.provider_platform_id = provider_platforms.id").
		Joins("JOIN users ON milestones.user_id = users.id")

	if search != "" {
		search = "%" + search + "%"
		query = query.Where("milestones.type ILIKE ?", search).Or("users.username ILIKE ?", search).Or("programs.name ILIKE ?", search).Or("provider_platforms.name ILIKE ?", search)
	}
	if err := query.Count(&total).Error; err != nil {
		return 0, nil, err
	}

	if orderBy != "" && IsValidOrderBy(orderBy) {
		query = query.Order(orderBy)
	}

	query = query.Limit(perPage).Offset((page - 1) * perPage)

	if err := query.Find(&content).Error; err != nil {
		return 0, nil, err
	}
	return total, content, nil
}

func (db *DB) GetMilestonesForUser(page, perPage int, id uint) (int64, []MilestoneResponse, error) {
	content := []MilestoneResponse{}
	total := int64(0)
	err := db.Conn.Model(&models.Milestone{}).Select("milestones.*, provider_platforms.name as provider_platform_name, programs.name as program_name, users.username").
		Joins("JOIN programs ON milestones.program_id = programs.id").
		Joins("JOIN provider_platforms ON programs.provider_platform_id = provider_platforms.id").
		Joins("JOIN users ON milestones.user_id = users.id").
		Where("user_id = ?", id).
		Count(&total).
		Limit(perPage).
		Offset((page - 1) * perPage).
		Find(&content).
		Error
	if err != nil {
		return 0, nil, err
	}
	return total, content, nil
}

func (db *DB) CreateMilestone(content *models.Milestone) (*models.Milestone, error) {
	if err := db.Conn.Create(content).Error; err != nil {
		return nil, err
	}
	return content, nil
}

func (db *DB) UpdateMilestone(content *models.Milestone) (*models.Milestone, error) {
	if err := db.Conn.Save(content).Error; err != nil {
		return nil, err
	}
	return content, nil
}

func (db *DB) DeleteMilestone(id int) error {
	if err := db.Conn.Where("id = ?", id).Delete(&models.Milestone{}).Error; err != nil {
		return err
	}
	return nil
}

func (db *DB) GetMilestoneByID(id int) (*models.Milestone, error) {
	content := &models.Milestone{}
	if err := db.Conn.Where("id = ?", id).First(content).Error; err != nil {
		return nil, err
	}
	return content, nil
}
