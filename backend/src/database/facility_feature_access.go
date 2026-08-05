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

// GetFacilityFeatureAccess resolves the effective feature set for one facility:
// the statewide defaults (passed in by the caller, sourced from the server's
// cached feature_flags/page_feature_flags state) minus any feature this facility
// has explicitly disabled. A facility with no override row inherits the
// statewide value untouched. A sub-feature is never effective when its parent
// isn't — that cascade is enforced here regardless of the sub-feature's own
// override row, since disabling the parent doesn't retroactively clear it.
func (db *DB) GetFacilityFeatureAccess(facilityID uint, statewideDefaults []models.FeatureAccess) ([]models.FeatureAccess, error) {
	disabled, err := db.disabledFeatureSet(facilityID)
	if err != nil {
		return nil, err
	}
	enabled := make(map[models.FeatureAccess]bool, len(statewideDefaults))
	for _, f := range statewideDefaults {
		enabled[f] = !disabled[f]
	}
	effective := make([]models.FeatureAccess, 0, len(statewideDefaults))
	for _, f := range statewideDefaults {
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

func (db *DB) disabledFeatureSet(facilityID uint) (map[models.FeatureAccess]bool, error) {
	var overrides []models.FacilityFeatureFlag
	if err := db.Model(&models.FacilityFeatureFlag{}).Where("facility_id = ?", facilityID).Find(&overrides).Error; err != nil {
		return nil, newGetRecordsDBError(err, "facility_feature_flags")
	}
	disabled := make(map[models.FeatureAccess]bool, len(overrides))
	for _, o := range overrides {
		if !o.Enabled {
			disabled[o.Feature] = true
		}
	}
	return disabled, nil
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
	disabledByFacility := map[uint]map[models.FeatureAccess]bool{}
	if len(facilityIDs) > 0 {
		var overrides []models.FacilityFeatureFlag
		if err := db.Model(&models.FacilityFeatureFlag{}).Where("facility_id IN ?", facilityIDs).Find(&overrides).Error; err != nil {
			return nil, newGetRecordsDBError(err, "facility_feature_flags")
		}
		for _, o := range overrides {
			if o.Enabled {
				continue
			}
			if disabledByFacility[o.FacilityID] == nil {
				disabledByFacility[o.FacilityID] = map[models.FeatureAccess]bool{}
			}
			disabledByFacility[o.FacilityID][o.Feature] = true
		}
	}

	statewideSet := make(map[models.FeatureAccess]bool, len(statewideDefaults))
	for _, f := range statewideDefaults {
		statewideSet[f] = true
	}

	rows := make([]FacilityFeatureOverviewRow, 0, len(facilities))
	for _, f := range facilities {
		features := make(map[models.FeatureAccess]bool, len(models.TopLevelFeatures))
		for _, feat := range models.TopLevelFeatures {
			features[feat] = statewideSet[feat] && !disabledByFacility[f.ID][feat]
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

// UpsertFacilityFeatureFlag sets one facility's override for one feature. Enabling
// a feature that's disabled statewide, or a sub-feature whose parent is disabled
// at this facility, is rejected — that state can never be represented in the UI.
func (db *DB) UpsertFacilityFeatureFlag(args *models.QueryContext, facilityID uint, feature models.FeatureAccess, enabled bool, statewideDefaults []models.FeatureAccess) error {
	if !models.ValidFeature(feature) {
		return newBadRequestDBError(errors.New("invalid feature"), "invalid feature")
	}
	if enabled {
		if !slices.Contains(statewideDefaults, feature) {
			return newBadRequestDBError(errors.New("feature disabled statewide"), "this feature is disabled statewide and cannot be enabled for a single facility")
		}
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
			// Statewide-disabled features are never representable per-facility;
			// skip rather than writing a row that would immediately be a no-op.
			if _, isSub := models.SubFeatureParent[feature]; !isSub && !slices.Contains(statewideDefaults, feature) {
				continue
			}
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
