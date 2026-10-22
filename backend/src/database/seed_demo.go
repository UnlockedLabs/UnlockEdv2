package database

import (
	"context"

	"github.com/UnlockedLabs/unlocked-core/backend/src/models"
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/registry"
)

func (db *DB) RunOrResetDemoSeed(facilityId uint) error {
	ctx := context.Background()
	learning := registry.ProviderPlatforms(db.DB)
	// seeding data for demo will only seed user activity/milestones/open-content activity for existing users
	lastSeed, found, err := learning.LastDemoSeed(ctx)
	if err != nil || !found {
		return db.RunDemoSeed(facilityId)
	}
	if err := learning.ResetDemoLearning(ctx, lastSeed); err != nil {
		return newDeleteDBError(err, "demo learning data")
	}
	if err := registry.OpenContent(db.DB).ResetDemoActivity(ctx, lastSeed); err != nil {
		return newDeleteDBError(err, "open_content_activities")
	}
	return db.RunDemoSeed(facilityId)
}

func (db *DB) RunDemoSeed(facilityId uint) error {
	var userIDs []uint
	if err := db.Model(&models.User{}).Where("facility_id = ?", facilityId).Pluck("id", &userIDs).Error; err != nil {
		return newGetRecordsDBError(err, "users")
	}
	ctx := context.Background()
	if err := registry.OpenContent(db.DB).SeedDemoActivity(ctx, facilityId, userIDs); err != nil {
		return newCreateDBError(err, "open_content_activities")
	}
	if err := registry.ProviderPlatforms(db.DB).SeedDemoLearning(ctx, userIDs); err != nil {
		return newCreateDBError(err, "demo learning data")
	}
	return nil
}
