package main

import (
	"UnlockEdv2/src/models"
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
	"gorm.io/gorm"
)

// handleActivateScheduledClasses is the entrypoint for the daily
// `tasks.activate_scheduled_classes` job. It flips any class whose scheduled
// start date has is the current day of the job run (in its facility's local timezone) from Scheduled to
// Active. The status update goes through the same map-based update the user interface uses
// so that ProgramClass.AfterUpdate fires and backfills enrolled_at on the
// class's enrollments.
func (sh *ServiceHandler) handleActivateScheduledClasses(ctx context.Context, msg *nats.Msg) {
	var body map[string]any
	if err := json.Unmarshal(msg.Data, &body); err != nil {
		logger().Errorf("failed to unmarshal activate_scheduled_classes message: %v", err)
		return
	}
	jobId, ok := body["job_id"].(string)
	if !ok {
		logger().Errorf("job_id not found in activate_scheduled_classes message: %v", body)
		return
	}
	success := sh.activateScheduledClasses(ctx) == nil
	sh.cleanupJob(ctx, nil, jobId, success)
}

func (sh *ServiceHandler) activateScheduledClasses(ctx context.Context) error {
	batchUserID, err := sh.systemBatchUserID(ctx)
	if err != nil { //batch id doesn't exist then fail
		logger().Errorf("cannot activate scheduled classes: %v", err)
		return err
	}

	var classIDs []int
	if err := sh.db.WithContext(ctx).
		Model(&models.ProgramClass{}).
		Joins("JOIN facilities f ON f.id = program_classes.facility_id").
		Where("program_classes.status = ?", models.Scheduled).
		Where("program_classes.archived_at IS NULL").
		Where("program_classes.start_dt <= (now() AT TIME ZONE f.timezone)::date").
		Pluck("program_classes.id", &classIDs).Error; err != nil {
		logger().Errorf("failed to query scheduled classes to activate: %v", err)
		return err
	}

	if len(classIDs) == 0 {
		logger().Infoln("no scheduled classes are due for activation")
		return nil
	}
	logger().Infof("activating %d scheduled class(es): %v", len(classIDs), classIDs)

	batchCtx := context.WithValue(ctx, models.UserIDKey, batchUserID)
	enrolledAt := time.Now().UTC()
	if err := sh.db.WithContext(batchCtx).Transaction(func(tx *gorm.DB) error {
		if err := tx.
			Model(&models.ProgramClass{}).
			Where("id IN ?", classIDs).
			Set("class_ids", classIDs).
			Updates(map[string]any{"status": models.Active}).Error; err != nil {
			return err
		}
		return tx.
			Model(&models.ProgramClassEnrollment{}).
			Where("class_id IN ?", classIDs).
			Where("enrollment_status = ?", models.Enrolled).
			Where("enrolled_at IS NULL").
			Updates(map[string]any{
				"enrolled_at":    enrolledAt,
				"update_user_id": batchUserID,
			}).Error
	}); err != nil {
		logger().Errorf("failed to activate scheduled classes %v: %v", classIDs, err)
		return err
	}
	return nil
}

func (sh *ServiceHandler) systemBatchUserID(ctx context.Context) (uint, error) {
	var user models.User
	if err := sh.db.WithContext(ctx).
		Where("username = ?", "system_batch").
		First(&user).Error; err != nil {
		return 0, fmt.Errorf("system_batch user not found: %w", err)
	}
	return user.ID, nil
}
