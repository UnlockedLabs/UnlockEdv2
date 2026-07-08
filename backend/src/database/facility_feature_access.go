package database

import (
	"UnlockEdv2/src/models"
	"errors"
	"slices"

	"gorm.io/gorm"
)

// GetFacilityFeatureAccess resolves the effective feature set for a single
// facility: the globally-enabled features (top-level + their enabled page
// features) minus anything this facility has explicitly disabled via an
// override row. A facility with no override rows inherits the global set.
//
// Layering rule: effective = global_enabled AND NOT facility_disabled.
// Disabling a parent feature at the facility also drops its page (sub)
// features, mirroring the global parent rule in TogglePageFeature.
func (db *DB) GetFacilityFeatureAccess(facilityID uint) ([]models.FeatureAccess, error) {
	var featureFlags []models.FeatureFlags
	if err := db.Preload("PageFeatures").Model(&models.FeatureFlags{}).Where("enabled = ?", true).Find(&featureFlags).Error; err != nil {
		return nil, newNotFoundDBError(err, "unable to fetch features")
	}

	disabled, err := db.facilityDisabledFeatures(facilityID)
	if err != nil {
		return nil, err
	}

	var features []models.FeatureAccess
	for _, flag := range featureFlags {
		if disabled[flag.Name] {
			continue // parent disabled at this facility -> skip it and its page features
		}
		features = append(features, flag.Name)
		for _, pageFeature := range flag.PageFeatures {
			if pageFeature.Enabled && !disabled[pageFeature.PageFeature] {
				features = append(features, pageFeature.PageFeature)
			}
		}
	}
	return features, nil
}

// globalEnabledFacilityFeatures returns the manageable top-level features
// (models.TopLevelFacilityFeatures) that are currently enabled globally, in
// display order. This is the universe of features the per-facility overview
// tracks — a globally-disabled feature can't be on at any facility, so it is
// omitted from the list and the counts.
func (db *DB) globalEnabledFacilityFeatures() ([]models.FeatureAccess, error) {
	var enabledNames []models.FeatureAccess
	if err := db.Model(&models.FeatureFlags{}).
		Where("enabled = ? AND name IN ?", true, models.TopLevelFacilityFeatures).
		Pluck("name", &enabledNames).Error; err != nil {
		return nil, newGetRecordsDBError(err, "feature_flags")
	}
	enabledSet := make(map[models.FeatureAccess]bool, len(enabledNames))
	for _, n := range enabledNames {
		enabledSet[n] = true
	}
	// preserve TopLevelFacilityFeatures display order
	universe := make([]models.FeatureAccess, 0, len(enabledNames))
	for _, f := range models.TopLevelFacilityFeatures {
		if enabledSet[f] {
			universe = append(universe, f)
		}
	}
	return universe, nil
}

// GetAllFacilitiesFeatureStatus powers the master list: one row per facility
// with the effective on/off state of each manageable, globally-enabled
// top-level feature plus an "enabled of total" count. Supports the mockup's
// "Show: <feature> = On/Off" filter and facility pagination.
//
// Only enabled=false override rows change a top-level feature's effective
// state (an explicit enabled=true row resolves the same as inherit), so
// filtering and status both key off the set of facilities that have disabled
// the feature.
func (db *DB) GetAllFacilitiesFeatureStatus(page, perPage int, filterFeature *models.FeatureAccess, filterEnabled *bool) (int64, []models.FacilityFeatureStatus, error) {
	universe, err := db.globalEnabledFacilityFeatures()
	if err != nil {
		return 0, nil, err
	}

	tx := db.Model(&models.Facility{})

	// Apply the optional "feature = on/off" filter before paginating.
	if filterFeature != nil && filterEnabled != nil {
		globalOn := false
		for _, f := range universe {
			if f == *filterFeature {
				globalOn = true
				break
			}
		}
		disabledFacilityIDs := db.Model(&models.FacilityFeatureFlag{}).
			Select("facility_id").
			Where("feature = ? AND enabled = ?", *filterFeature, false)

		switch {
		case !globalOn && *filterEnabled:
			// feature isn't globally on (or isn't manageable) -> on nowhere
			return 0, []models.FacilityFeatureStatus{}, nil
		case !globalOn && !*filterEnabled:
			// off everywhere -> no additional constraint (all facilities match)
		case globalOn && *filterEnabled:
			tx = tx.Where("id NOT IN (?)", disabledFacilityIDs)
		case globalOn && !*filterEnabled:
			tx = tx.Where("id IN (?)", disabledFacilityIDs)
		}
	}

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "facilities")
	}

	var facilities []models.Facility
	if err := tx.Order("name ASC").
		Limit(perPage).Offset(calcOffset(page, perPage)).
		Find(&facilities).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "facilities")
	}

	// Load the disabled overrides for just this page of facilities in one query.
	facilityIDs := make([]uint, len(facilities))
	for i, f := range facilities {
		facilityIDs[i] = f.ID
	}
	disabledByFacility := map[uint]map[models.FeatureAccess]bool{}
	if len(facilityIDs) > 0 {
		var overrides []models.FacilityFeatureFlag
		if err := db.Model(&models.FacilityFeatureFlag{}).
			Where("facility_id IN ? AND enabled = ?", facilityIDs, false).
			Find(&overrides).Error; err != nil {
			return 0, nil, newGetRecordsDBError(err, "facility_feature_flags")
		}
		for _, o := range overrides {
			if disabledByFacility[o.FacilityID] == nil {
				disabledByFacility[o.FacilityID] = map[models.FeatureAccess]bool{}
			}
			disabledByFacility[o.FacilityID][o.Feature] = true
		}
	}

	statuses := make([]models.FacilityFeatureStatus, len(facilities))
	for i, f := range facilities {
		features := make([]models.FeatureToggleStatus, len(universe))
		enabledCount := 0
		for j, feature := range universe {
			// every feature in universe is globally on, so effective = not facility-disabled
			enabled := !disabledByFacility[f.ID][feature]
			if enabled {
				enabledCount++
			}
			features[j] = models.FeatureToggleStatus{Feature: feature, Enabled: enabled}
		}
		statuses[i] = models.FacilityFeatureStatus{
			FacilityID:   f.ID,
			FacilityName: f.Name,
			Features:     features,
			EnabledCount: enabledCount,
			TotalCount:   len(universe),
		}
	}
	return total, statuses, nil
}

// GetFacilityFeatureDetail returns the right-panel payload for one facility:
// every manageable top-level feature (models.TopLevelFacilityFeatures) with its
// page sub-features nested underneath. Features are included regardless of
// global state — a globally-disabled feature is returned with GloballyEnabled
// false so the client can grey its toggle rather than hide it.
func (db *DB) GetFacilityFeatureDetail(facilityID uint) (models.FacilityFeatureDetail, error) {
	var facility models.Facility
	if err := db.Model(&models.Facility{}).Where("id = ?", facilityID).First(&facility).Error; err != nil {
		return models.FacilityFeatureDetail{}, newNotFoundDBError(err, "facilities")
	}

	// Load all top-level flags + their page features (enabled or not) for global
	// availability and structure.
	var flags []models.FeatureFlags
	if err := db.Preload("PageFeatures").Model(&models.FeatureFlags{}).Find(&flags).Error; err != nil {
		return models.FacilityFeatureDetail{}, newGetRecordsDBError(err, "feature_flags")
	}
	globalByName := make(map[models.FeatureAccess]models.FeatureFlags, len(flags))
	for _, f := range flags {
		globalByName[f.Name] = f
	}

	disabled, err := db.facilityDisabledFeatures(facilityID)
	if err != nil {
		return models.FacilityFeatureDetail{}, err
	}

	detail := models.FacilityFeatureDetail{FacilityID: facility.ID, FacilityName: facility.Name}
	for _, feature := range models.TopLevelFacilityFeatures {
		flag, ok := globalByName[feature]
		globallyEnabled := ok && flag.Enabled
		item := models.FacilityFeatureDetailItem{
			Feature:         feature,
			GloballyEnabled: globallyEnabled,
			Enabled:         globallyEnabled && !disabled[feature],
		}
		if ok {
			for _, pf := range flag.PageFeatures {
				item.PageFeatures = append(item.PageFeatures, models.FacilityFeatureDetailItem{
					Feature:         pf.PageFeature,
					GloballyEnabled: pf.Enabled,
					Enabled:         pf.Enabled && !disabled[pf.PageFeature],
				})
			}
		}
		detail.Features = append(detail.Features, item)
	}
	return detail, nil
}

// ToggleFacilityFeature sets the enabled state of a single feature for one
// facility (upsert of the override row). It enforces the layering rules:
//   - disabling is always allowed;
//   - a top-level feature can only be enabled when its global master is on;
//   - a page feature can only be enabled when it is globally enabled AND its
//     parent is effectively on at this facility (global parent on and not
//     disabled at the facility) — mirroring the global TogglePageFeature rule.
//
// Toggling a parent does not cascade to page rows; the resolver
// (GetFacilityFeatureAccess) derives effective state, so a facility's explicit
// sub-feature overrides survive a parent off/on cycle. Re-enabling writes an
// explicit enabled=true row (audit trail) rather than deleting the override.
func (db *DB) ToggleFacilityFeature(facilityID uint, feature models.FeatureAccess, enabled bool) error {
	var facility models.Facility
	if err := db.Model(&models.Facility{}).Where("id = ?", facilityID).First(&facility).Error; err != nil {
		return newNotFoundDBError(err, "facilities")
	}

	isTopLevel := slices.Contains(models.TopLevelFacilityFeatures, feature)
	var parentName models.FeatureAccess
	if !isTopLevel {
		// Must be a known page feature whose parent is a manageable top-level feature.
		var pf models.PageFeatureFlags
		if err := db.Model(&models.PageFeatureFlags{}).Where("page_feature = ?", feature).First(&pf).Error; err != nil {
			return newBadRequestDBError("feature is not manageable per-facility")
		}
		var parent models.FeatureFlags
		if err := db.Model(&models.FeatureFlags{}).Where("id = ?", pf.FeatureFlagID).First(&parent).Error; err != nil {
			return newNotFoundDBError(err, "feature_flags")
		}
		parentName = parent.Name
		if enabled {
			if !pf.Enabled {
				return newBadRequestDBError("cannot enable a feature that is disabled statewide")
			}
			effectiveParent, err := db.featureEffectiveAtFacility(facilityID, parentName)
			if err != nil {
				return err
			}
			if !effectiveParent {
				return newBadRequestDBError("cannot enable a sub-feature while its parent is off")
			}
		}
	} else if enabled {
		globalOn, err := db.featureGloballyEnabled(feature)
		if err != nil {
			return err
		}
		if !globalOn {
			return newBadRequestDBError("cannot enable a feature that is disabled statewide")
		}
	}

	// Upsert via find-then-create/save so the audit hooks (create_user_id /
	// update_user_id) fire on their respective paths.
	var existing models.FacilityFeatureFlag
	err := db.Model(&models.FacilityFeatureFlag{}).
		Where("facility_id = ? AND feature = ?", facilityID, feature).
		First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		row := models.FacilityFeatureFlag{FacilityID: facilityID, Feature: feature, Enabled: enabled}
		if err := db.Create(&row).Error; err != nil {
			return newCreateDBError(err, "facility_feature_flags")
		}
		return nil
	}
	if err != nil {
		return newGetRecordsDBError(err, "facility_feature_flags")
	}
	existing.Enabled = enabled
	if err := db.Save(&existing).Error; err != nil {
		return newUpdateDBError(err, "facility_feature_flags")
	}
	return nil
}

// featureGloballyEnabled reports whether a top-level feature's global master is on.
func (db *DB) featureGloballyEnabled(feature models.FeatureAccess) (bool, error) {
	var flag models.FeatureFlags
	if err := db.Model(&models.FeatureFlags{}).Where("name = ?", feature).First(&flag).Error; err != nil {
		return false, newNotFoundDBError(err, "feature_flags")
	}
	return flag.Enabled, nil
}

// featureEffectiveAtFacility reports whether a top-level feature is effectively
// on for a facility: globally enabled and not disabled by a facility override.
func (db *DB) featureEffectiveAtFacility(facilityID uint, feature models.FeatureAccess) (bool, error) {
	globalOn, err := db.featureGloballyEnabled(feature)
	if err != nil {
		return false, err
	}
	if !globalOn {
		return false, nil
	}
	disabled, err := db.facilityDisabledFeatures(facilityID)
	if err != nil {
		return false, err
	}
	return !disabled[feature], nil
}

// facilityDisabledFeatures returns the set of features a facility has an
// explicit override row disabling (enabled = false). Features with no row,
// or a row with enabled = true, are absent from the set (they inherit / are on).
func (db *DB) facilityDisabledFeatures(facilityID uint) (map[models.FeatureAccess]bool, error) {
	var overrides []models.FacilityFeatureFlag
	if err := db.Model(&models.FacilityFeatureFlag{}).
		Where("facility_id = ? AND enabled = ?", facilityID, false).
		Find(&overrides).Error; err != nil {
		return nil, newGetRecordsDBError(err, "facility_feature_flags")
	}
	disabled := make(map[models.FeatureAccess]bool, len(overrides))
	for _, o := range overrides {
		disabled[o.Feature] = true
	}
	return disabled, nil
}
