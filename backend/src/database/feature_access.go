package database

import (
	"UnlockEdv2/src/models"

	"github.com/sirupsen/logrus"
)

// GetFeatureAccess returns the statewide default feature set: every top-level
// feature that's enabled, plus every enabled page-level (sub-)feature. This is
// the floor that GetFacilityFeatureAccess layers per-facility overrides on top
// of; it is no longer directly editable via any UI (see facility_feature_access.go).
func (db *DB) GetFeatureAccess() ([]models.FeatureAccess, error) {
	var featureFlags []models.FeatureFlags
	// is_page_feature excludes the shadow rows copied from page_feature_flags (EN-96) --
	// those exist only so facility_feature_flags has a real id to reference for sub-feature
	// overrides, and would otherwise be double-counted here as their own top-level flags.
	if err := db.Preload("PageFeatures").Model(&models.FeatureFlags{}).Where("is_page_feature = ?", false).Find(&featureFlags).Error; err != nil {
		return nil, newNotFoundDBError(err, "unable to fetch features")
	}

	var features []models.FeatureAccess
	for _, flag := range featureFlags { //build the feature flags here
		if !models.DefaultEnabled[flag.Name] {
			continue
		}
		features = append(features, flag.Name)
		for _, pageFeature := range flag.PageFeatures {
			if pageFeature.Enabled {
				features = append(features, pageFeature.PageFeature)
			}
		}
	}

	return features, nil
}

// seedTestFeatureFlags mirrors the feature_flags/page_feature_flags seed rows the
// Postgres migrations insert (00018/00057/00069/00072/00075/00077). The SQLite test
// DB only gets its schema from MigrateTesting's AutoMigrate, never those SQL files, so
// without this, facility-level feature overrides (which resolve through feature_flags.id)
// would have no rows to look up.
func (db *DB) seedTestFeatureFlags() {
	ids := make(map[models.FeatureAccess]uint, len(models.TopLevelFeatures))
	for _, name := range models.TopLevelFeatures {
		flag := models.FeatureFlags{Name: name}
		if err := db.Create(&flag).Error; err != nil {
			logrus.Fatalf("Failed to create feature flag: %v", err)
		}
		ids[name] = flag.ID
	}
	for sub, parent := range models.SubFeatureParent {
		shadow := models.FeatureFlags{Name: sub, IsPageFeature: true}
		if err := db.Create(&shadow).Error; err != nil {
			logrus.Fatalf("Failed to create page feature shadow flag: %v", err)
		}
		if err := db.Create(&models.PageFeatureFlags{
			FeatureFlagID: ids[parent],
			PageFeature:   sub,
			Enabled:       true,
		}).Error; err != nil {
			logrus.Fatalf("Failed to create page feature flag: %v", err)
		}
	}
}
