package database

import "UnlockEdv2/src/models"

func (db *DB) GetClientForProvider(provID uint) (*models.OidcClient, error) {
	client := models.OidcClient{}
	err := db.Conn.Where("provider_platform_id = ?", provID).First(&client).Error
	return &client, LogDbError(err)
}

func (db *DB) GetAllRegisteredClients() ([]models.OidcClient, error) {
	var clients []models.OidcClient
	err := db.Conn.Find(&clients).Error
	return clients, LogDbError(err)
}

func (db *DB) RegisterClient(client *models.OidcClient) error {
	return LogDbError(db.Conn.Create(client).Error)
}
