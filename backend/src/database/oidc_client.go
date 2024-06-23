package database

import "UnlockEdv2/src/models"

func (db *DB) GetClientForProvider(provID uint) (*models.OidcClient, error) {
	client := models.OidcClient{}
	err := LogDbError(db.Conn.Where("provider_platform_id = ?", provID).First(&client).Error, "Failed to get client.")
	return &client, err
}

func (db *DB) GetAllRegisteredClients() ([]models.OidcClient, error) {
	var clients []models.OidcClient
	err := LogDbError(db.Conn.Find(&clients).Error, "Failed to get registered clients.")
	return clients, err
}

func (db *DB) RegisterClient(client *models.OidcClient) error {
	return LogDbError(db.Conn.Create(client).Error, "Failed to register client.")
}
