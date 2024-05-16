package models

import (
	"time"
)

type JobType string

const (
	ImportUsers      JobType = "importUsers"
	ImportPrograms   JobType = "importPrograms"
	ImportMilestones JobType = "importMilestones"
)

var AllJobs = []JobType{ImportUsers, ImportPrograms, ImportMilestones}

type Status string

const (
	Pending Status = "pending"
	Running Status = "running"
	Success Status = "success"
	Failed  Status = "failed"
)

type StoredJob struct {
	DatabaseFields
	JobType JobType `gorm:"not null" json:"job_type"`
}

func (StoredJob) TableName() string {
	return "jobs"
}

type ScheduledJob struct {
	ID          uint      `gorm:"primaryKey"`
	JobID       uint      `gorm:"not null" json:"job_id"`
	Status      Status    `gorm:"not null" json:"status"`
	LastRunTime time.Time `gorm:"not null" json:"last_run_time"`
	Error       string    `json:"error"`

	Job *StoredJob `gorm:"foreignKey:JobID;references:ID"`
}

func (ScheduledJob) TableName() string {
	return "scheduled_jobs"
}
