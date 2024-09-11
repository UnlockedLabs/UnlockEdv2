package database

import "UnlockEdv2/src/models"

func (db *DB) GetClientForProvider(provID uint) (*models.OidcClient, error) {
	client := models.OidcClient{}
	err := db.Where("provider_platform_id = ?", provID).First(&client).Error
	return &client, err
}

func (db *DB) GetAllRegisteredClients() ([]models.OidcClient, error) {
	var clients []models.OidcClient

	if err := db.Find(&clients).Error; err != nil {
		return clients, newGetRecordsDBError(err, "oidc_clients")
	}
	return clients, nil
}

func (db *DB) RegisterClient(client *models.OidcClient) error {
	if err := db.Create(client).Error; err != nil {
		return newCreateDBError(err, "oidc_clients")
	}
	return nil
}

func (db *DB) GetOidcClientById(id string) (*models.OidcClient, error) {
	client := &models.OidcClient{}
	if err := db.Find(client, "id = ?", id).Error; err != nil {
		return client, newNotFoundDBError(err, "oidc_clients")
	}
	return client, nil
}
