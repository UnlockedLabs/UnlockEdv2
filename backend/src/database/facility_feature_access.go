package database

import (
	"UnlockEdv2/src/models"
	"errors"
	"slices"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type FacilityFeatureOverviewRow struct {
	FacilityID   uint                          `json:"facility_id"`
	FacilityName string                        `json:"facility_name"`
	Features     map[models.FeatureAccess]bool `json:"features"`
}

type FacilityFeatureDetailRow struct {
	Feature models.FeatureAccess `json:"feature"`
	Enabled bool                 `json:"enabled"`
}

// GetFacilityFeatureAccess resolves the effective feature set for one facility.
// A facility's own override row wins in both directions: it may enable a feature
// that is off statewide, or disable one that is on. The statewide defaults
// (passed in by the caller, sourced from the server's cached feature_flags/
// page_feature_flags state) apply only to features the facility has no row for.
// A sub-feature is never effective when its parent isn't — that cascade is
// enforced here regardless of the sub-feature's own override row, since
// disabling the parent doesn't retroactively clear it.
func (db *DB) GetFacilityFeatureAccess(facilityID uint, statewideDefaults []models.FeatureAccess) ([]models.FeatureAccess, error) {
	overrides, err := db.facilityOverrides(facilityID)
	if err != nil {
		return nil, err
	}
	enabled := resolveFeatures(statewideDefaults, overrides)
	effective := make([]models.FeatureAccess, 0, len(models.AllFeatures))
	for _, f := range models.AllFeatures {
		if !enabled[f] {
			continue
		}
		if parent, ok := models.SubFeatureParent[f]; ok && !enabled[parent] {
			continue
		}
		effective = append(effective, f)
	}
	return effective, nil
}

// resolveFeatures gives every known feature its pre-cascade state: the facility's
// override where one exists, otherwise the statewide default.
func resolveFeatures(statewideDefaults []models.FeatureAccess, overrides map[models.FeatureAccess]bool) map[models.FeatureAccess]bool {
	statewideSet := make(map[models.FeatureAccess]bool, len(statewideDefaults))
	for _, f := range statewideDefaults {
		statewideSet[f] = true
	}
	states := make(map[models.FeatureAccess]bool, len(models.AllFeatures))
	for _, f := range models.AllFeatures {
		if override, ok := overrides[f]; ok {
			states[f] = override
		} else {
			states[f] = statewideSet[f]
		}
	}
	return states
}

// facilityOverrides returns one facility's explicit settings. Presence of a key
// means the facility has been explicitly set; the value is that setting.
func (db *DB) facilityOverrides(facilityID uint) (map[models.FeatureAccess]bool, error) {
	var overrides []models.FacilityFeatureFlag
	if err := db.Model(&models.FacilityFeatureFlag{}).Where("facility_id = ?", facilityID).Find(&overrides).Error; err != nil {
		return nil, newGetRecordsDBError(err, "facility_feature_flags")
	}
	set := make(map[models.FeatureAccess]bool, len(overrides))
	for _, o := range overrides {
		set[o.Feature] = o.Enabled
	}
	return set, nil
}

// GetFacilityFeatureOverview returns, for every facility (optionally filtered by
// name search and by a single feature's on/off state), the effective state of
// each top-level feature — the data behind the Feature Control list panel's
// pills and "X of Y on" counts.
func (db *DB) GetFacilityFeatureOverview(args *models.QueryContext, statewideDefaults []models.FeatureAccess, filterFeature *models.FeatureAccess, filterEnabled *bool) ([]FacilityFeatureOverviewRow, error) {
	var facilities []models.Facility
	tx := db.WithContext(args.Ctx).Model(&models.Facility{}).Order("name asc")
	if args.Search != "" {
		tx = tx.Where("LOWER(name) LIKE LOWER(?)", "%"+args.Search+"%")
	}
	if err := tx.Find(&facilities).Error; err != nil {
		return nil, newGetRecordsDBError(err, "facilities")
	}

	facilityIDs := make([]uint, len(facilities))
	for i, f := range facilities {
		facilityIDs[i] = f.ID
	}
	overridesByFacility := map[uint]map[models.FeatureAccess]bool{}
	if len(facilityIDs) > 0 {
		var overrides []models.FacilityFeatureFlag
		if err := db.Model(&models.FacilityFeatureFlag{}).Where("facility_id IN ?", facilityIDs).Find(&overrides).Error; err != nil {
			return nil, newGetRecordsDBError(err, "facility_feature_flags")
		}
		for _, o := range overrides {
			if overridesByFacility[o.FacilityID] == nil {
				overridesByFacility[o.FacilityID] = map[models.FeatureAccess]bool{}
			}
			overridesByFacility[o.FacilityID][o.Feature] = o.Enabled
		}
	}

	rows := make([]FacilityFeatureOverviewRow, 0, len(facilities))
	for _, f := range facilities {
		enabled := resolveFeatures(statewideDefaults, overridesByFacility[f.ID])
		features := make(map[models.FeatureAccess]bool, len(models.TopLevelFeatures))
		for _, feat := range models.TopLevelFeatures {
			features[feat] = enabled[feat]
		}
		if filterFeature != nil {
			want := true
			if filterEnabled != nil {
				want = *filterEnabled
			}
			if features[*filterFeature] != want {
				continue
			}
		}
		rows = append(rows, FacilityFeatureOverviewRow{FacilityID: f.ID, FacilityName: f.Name, Features: features})
	}
	return rows, nil
}

// GetFacilityFeatureDetail returns every feature (top-level and sub) with its
// effective state for one facility — the data behind the detail panel.
func (db *DB) GetFacilityFeatureDetail(facilityID uint, statewideDefaults []models.FeatureAccess) ([]FacilityFeatureDetailRow, error) {
	effective, err := db.GetFacilityFeatureAccess(facilityID, statewideDefaults)
	if err != nil {
		return nil, err
	}
	rows := make([]FacilityFeatureDetailRow, 0, len(models.AllFeatures))
	for _, f := range models.AllFeatures {
		rows = append(rows, FacilityFeatureDetailRow{Feature: f, Enabled: slices.Contains(effective, f)})
	}
	return rows, nil
}

// UpsertFacilityFeatureFlag sets one facility's override for one feature. Any
// feature may be enabled or disabled per facility regardless of its statewide
// default; only enabling a sub-feature whose parent is disabled at this facility
// is rejected, since that state can never be represented in the UI.
func (db *DB) UpsertFacilityFeatureFlag(args *models.QueryContext, facilityID uint, feature models.FeatureAccess, enabled bool, statewideDefaults []models.FeatureAccess) error {
	if !models.ValidFeature(feature) {
		return newBadRequestDBError(errors.New("invalid feature"), "invalid feature")
	}
	if enabled {
		if parent, ok := models.SubFeatureParent[feature]; ok {
			effective, err := db.GetFacilityFeatureAccess(facilityID, statewideDefaults)
			if err != nil {
				return err
			}
			if !slices.Contains(effective, parent) {
				return newBadRequestDBError(errors.New("parent feature disabled"), "cannot enable this feature while its parent feature is disabled for this facility")
			}
		}
	}
	row := models.FacilityFeatureFlag{FacilityID: facilityID, Feature: feature, Enabled: enabled}
	if args.UserID != 0 {
		uid := args.UserID
		row.UpdateUserID = &uid
	}
	if err := db.WithContext(args.Ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "facility_id"}, {Name: "feature"}},
		DoUpdates: clause.AssignmentColumns([]string{"enabled", "update_user_id", "updated_at"}),
	}).Create(&row).Error; err != nil {
		return newCreateDBError(err, "facility_feature_flags")
	}
	return nil
}

// ApplyFacilityFeaturesToAll copies the source facility's effective value for every
// feature (top-level and sub) to every other facility, in one transaction.
func (db *DB) ApplyFacilityFeaturesToAll(args *models.QueryContext, sourceFacilityID uint, statewideDefaults []models.FeatureAccess) error {
	// An unknown source facility has no override rows, so its effective set would
	// resolve to the untouched statewide defaults, and every real facility would
	// then match the `id != source` target filter below — silently resetting every
	// facility in the system. Reject it before anything is written.
	var sourceExists bool
	if err := db.WithContext(args.Ctx).Model(&models.Facility{}).
		Select("count(*) > 0").Where("id = ?", sourceFacilityID).Find(&sourceExists).Error; err != nil {
		return newGetRecordsDBError(err, "facilities")
	}
	if !sourceExists {
		return newNotFoundDBError(gorm.ErrRecordNotFound, "facilities")
	}

	effective, err := db.GetFacilityFeatureAccess(sourceFacilityID, statewideDefaults)
	if err != nil {
		return err
	}
	effectiveSet := make(map[models.FeatureAccess]bool, len(effective))
	for _, f := range effective {
		effectiveSet[f] = true
	}

	var facilityIDs []uint
	if err := db.WithContext(args.Ctx).Model(&models.Facility{}).
		Where("id != ?", sourceFacilityID).Pluck("id", &facilityIDs).Error; err != nil {
		return newGetRecordsDBError(err, "facilities")
	}
	if len(facilityIDs) == 0 {
		return nil
	}

	var uid *uint
	if args.UserID != 0 {
		u := args.UserID
		uid = &u
	}

	rows := make([]models.FacilityFeatureFlag, 0, len(facilityIDs)*len(models.AllFeatures))
	for _, fid := range facilityIDs {
		for _, feature := range models.AllFeatures {
			rows = append(rows, models.FacilityFeatureFlag{
				FacilityID:   fid,
				Feature:      feature,
				Enabled:      effectiveSet[feature],
				UpdateUserID: uid,
			})
		}
	}
	if len(rows) == 0 {
		return nil
	}

	return db.WithContext(args.Ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "facility_id"}, {Name: "feature"}},
			DoUpdates: clause.AssignmentColumns([]string{"enabled", "update_user_id", "updated_at"}),
		}).Create(&rows).Error; err != nil {
			return newCreateDBError(err, "facility_feature_flags")
		}
		return nil
	})
}
