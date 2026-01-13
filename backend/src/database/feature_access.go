package database

import (
	"UnlockEdv2/src/models"
	"errors"
)

func (db *DB) GetFeatureAccess() ([]models.FeatureAccess, error) {
	var featureFlags []models.FeatureFlags
	if err := db.Preload("PageFeatures").Model(&models.FeatureFlags{}).Where("enabled = ?", true).Find(&featureFlags).Error; err != nil {
		return nil, newNotFoundDBError(err, "unable to fetch features")
	}

	var features []models.FeatureAccess
	for _, flag := range featureFlags { //build the feature flags here
		features = append(features, flag.Name)
		for _, pageFeature := range flag.PageFeatures {
			if pageFeature.Enabled {
				features = append(features, pageFeature.PageFeature)
			}
		}
	}

	return features, nil
}

func (db *DB) ToggleFeatureAccess(name string) error {
	var featureFlag models.FeatureFlags
	if err := db.Preload("PageFeatures").Model(&models.FeatureFlags{}).Where("name = ?", name).First(&featureFlag).Error; err != nil {
		return newNotFoundDBError(err, "unable to find feature")
	}
	featureFlag.Enabled = !featureFlag.Enabled
	if err := db.Save(&featureFlag).Error; err != nil {
		return newCreateDBError(err, "unable to save feature")
	}
	if len(featureFlag.PageFeatures) > 0 {
		update := map[string]any{"enabled": featureFlag.Enabled}
		if ctx := db.Statement.Context; ctx != nil {
			if userID, ok := ctx.Value(models.UserIDKey).(uint); ok {
				update["update_user_id"] = userID
			}
		}
		if err := db.Model(&models.PageFeatureFlags{}).Where("feature_flag_id = ?", featureFlag.ID).Updates(update).Error; err != nil {
			return newCreateDBError(err, "unable to update page features")
		}
	}
	return nil
}

func (db *DB) TogglePageFeature(pageFeatureName string) error {
	var pageFeature models.PageFeatureFlags
	if err := db.Model(&models.PageFeatureFlags{}).Where("page_feature = ?", pageFeatureName).First(&pageFeature).Error; err != nil {
		return newNotFoundDBError(err, "page_feature_flags")
	}

	var parent models.FeatureFlags
	if err := db.Model(&models.FeatureFlags{}).
		Where("id = ?", pageFeature.FeatureFlagID).First(&parent).Error; err != nil {
		return newNotFoundDBError(err, "feature_flags")
	}

	if !parent.Enabled {
		return NewDBError(errors.New("parent feature disabled"), "cannot enable page feature when parent is disabled")
	}

	pageFeature.Enabled = !pageFeature.Enabled
	if err := db.Save(&pageFeature).Error; err != nil {
		return newCreateDBError(err, "page_feature_flags")
	}
	return nil
}
