package database

import (
	"UnlockEdv2/src/models"
)

func IsValidOrderBy(orderBy string) bool {
	validOrderFields := map[string]bool{
		"type":                 true,
		"user_id":              true,
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

func (db *DB) GetMilestones(page, perPage int, search, orderBy string) (int64, []models.Milestone, error) {
	var (
		content []models.Milestone
		total   int64
	)

	query := db.Conn.Model(&models.Milestone{})

	if search != "" {
		search = "%" + search + "%"
		query = query.Where("type LIKE ?", search)
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

func (db *DB) GetMilestonesByProviderPlatformID(id int) ([]models.Milestone, error) {
	content := []models.Milestone{}
	if err := db.Conn.Where("provider_platform_id = ?", id).Find(&content).Error; err != nil {
		return nil, err
	}
	return content, nil
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
