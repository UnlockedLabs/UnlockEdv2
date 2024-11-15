package database

import "UnlockEdv2/src/models"

func (db *DB) GetFeatureAccess() ([]models.FeatureAccess, error) {
	var features []models.FeatureAccess
	if err := db.Model(&models.FeatureFlags{}).Select("name").Where("enabled = ?", true).Scan(&features).Error; err != nil {
		return nil, newNotFoundDBError(err, "unable to fetch features")
	}
	return features, nil
}

func (db *DB) ToggleFeatureAccess(name string) error {
	var feature models.FeatureFlags
	if err := db.Model(&models.FeatureFlags{}).Where("name = ?", name).First(&feature).Error; err != nil {
		return newNotFoundDBError(err, "unable to find feature")
	}
	feature.Enabled = !feature.Enabled
	if err := db.Save(&feature).Error; err != nil {
		return newCreateDBError(err, "unable to save feature")
	}
	return nil
}
