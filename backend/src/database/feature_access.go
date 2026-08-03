package database

import (
	"UnlockEdv2/src/models"
)

// GetFeatureAccess returns the statewide default feature set: every top-level
// feature that's enabled, plus every enabled page-level (sub-)feature. This is
// the floor that GetFacilityFeatureAccess layers per-facility overrides on top
// of; it is no longer directly editable via any UI (see facility_feature_access.go).
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
