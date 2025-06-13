package database

import (
	"UnlockEdv2/src/models"
	"context"
)

func (db *DB) GetRunnableTask(ctx context.Context, jobType models.JobType) (*models.RunnableTask, error) {
	task := &models.RunnableTask{}
	if err := db.WithContext(ctx).Table("runnable_tasks AS rt").
		Joins("JOIN cron_jobs cj ON rt.job_id = cj.id").
		Where("cj.name = ?", jobType).First(task).Error; err != nil {
		return nil, newNotFoundDBError(err, "runnable_tasks")
	}
	return task, nil
}
