package database

import (
	"Go-Prototype/backend/cmd/models"
)

func (db *DB) GetContentByID(id int) (*models.Content, error) {
	content := &models.Content{}
	if err := db.Conn.First(content, id).Error; err != nil {
		return nil, err
	}
	return content, nil
}

func (db *DB) GetContent(page, perPage int) (int64, []models.Content, error) {
	content := []models.Content{}
	total := int64(0)
	_ = db.Conn.Model(&models.Content{}).Count(&total)
	if err := db.Conn.Limit(perPage).Offset((page - 1) * perPage).Find(&content).Error; err != nil {
		return 0, nil, err
	}
	return total, content, nil
}

func (db *DB) CreateContent(content *models.Content) (*models.Content, error) {
	if err := db.Conn.Create(content).Error; err != nil {
		return nil, err
	}
	return content, nil
}

func (db *DB) UpdateContent(content *models.Content) (*models.Content, error) {
	if err := db.Conn.Save(content).Error; err != nil {
		return nil, err
	}
	return content, nil
}

func (db *DB) DeleteContent(content *models.Content) error {
	if err := db.Conn.Delete(content).Error; err != nil {
		return err
	}
	return nil
}

func (db *DB) GetContentByProviderPlatformID(id int) ([]models.Content, error) {
	content := []models.Content{}
	if err := db.Conn.Where("provider_platform_id = ?", id).Find(&content).Error; err != nil {
		return nil, err
	}
	return content, nil
}

func (db *DB) GetContentByProgramID(id string) (*models.Content, error) {
	content := &models.Content{}
	if err := db.Conn.Where("program_id = ?", id).First(content).Error; err != nil {
		return nil, err
	}
	return content, nil
}
