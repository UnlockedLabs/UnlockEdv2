package database

import (
	"UnlockEdv2/src/models"
)

// GetFeatureAccess returns the statewide default state of every feature: each
// top-level feature that's enabled, plus each enabled page-level (sub-)feature.
// This is the floor that GetFacilityFeatureAccess layers per-facility overrides
// on top of; it is no longer directly editable via any UI (see
// facility_feature_access.go).
func (db *DB) GetFeatureAccess() ([]models.FeatureAccess, error) {
	var featureFlags []models.FeatureFlags
	if err := db.Preload("PageFeatures").Model(&models.FeatureFlags{}).Find(&featureFlags).Error; err != nil {
		return nil, newNotFoundDBError(err, "unable to fetch features")
	}
	return statewideDefaults(featureFlags), nil
}

// statewideDefaults is the pure half of GetFeatureAccess, split out so the
// parent/sub-feature interaction below can be tested without a database.
//
// A sub-feature's default is reported independently of whether its parent is
// enabled statewide. That looks wrong at a glance and is the fix for a real bug:
// this function only says what each flag DEFAULTS to, while whether it is
// EFFECTIVE is decided by the cascade in GetFacilityFeatureAccess, which already
// drops any sub-feature whose parent is off for that facility.
//
// Filtering here as well used to double-count the parent, and the two checks
// were not equivalent — this one reads the STATEWIDE parent, the cascade reads
// the FACILITY's. So a facility that switched a statewide-off parent on got the
// parent but none of its sub-features: they were missing from the defaults
// entirely, and with no override row of their own they resolved to false. That
// is the exact shape of ai_tutor (statewide off, enabled per facility), which
// would have left every such facility with the tutor on and both of its
// capabilities silently off.
//
// The three older parents are all enabled statewide, which is why nothing
// noticed until now.
func statewideDefaults(featureFlags []models.FeatureFlags) []models.FeatureAccess {
	var features []models.FeatureAccess
	for _, flag := range featureFlags {
		if flag.Enabled {
			features = append(features, flag.Name)
		}
		for _, pageFeature := range flag.PageFeatures {
			if pageFeature.Enabled {
				features = append(features, pageFeature.PageFeature)
			}
		}
	}
	return features
}
