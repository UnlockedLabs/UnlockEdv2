package models

import (
	"os"
	"time"

	"github.com/google/uuid"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type (
	CronJob struct {
		ID        string    `gorm:"primaryKey" json:"id"`
		Name      string    `gorm:"size 60" json:"name"`
		Schedule  string    `gorm:"size 60" json:"schedule"`
		CreatedAt time.Time `json:"created_at"`
	}
	JobType   string
	JobStatus string
)

func (CronJob) TableName() string { return "cron_jobs" }

type RunnableTask struct {
	ID                 uint                   `gorm:"primaryKey" json:"id"`
	JobID              string                 `gorm:"size 50" json:"job_id"`
	Parameters         map[string]interface{} `gorm:"-" json:"parameters"`
	LastRun            time.Time              `json:"last_run"`
	ProviderPlatformID uint                   `json:"provider_platform_id"`
	Status             JobStatus              `json:"status"`
	Schedule           string                 `json:"schedule"`
	*ProviderPlatform  `gorm:"foreignKey:ProviderPlatformID;references:ID" json:"-"`
	*CronJob           `gorm:"foreignKey:JobID;references:ID" json:"-"`
}

const (
	GetMilestonesJob JobType   = "get_milestones"
	GetProgramsJob   JobType   = "get_programs"
	GetActivityJob   JobType   = "get_activity"
	GetOutcomesJob   JobType   = "get_outcomes"
	StatusPending    JobStatus = "pending"
	StatusRunning    JobStatus = "running"
)

func (jt JobType) GetParams(db *gorm.DB, provId uint) (map[string]interface{}, error) {
	var users []ProviderUserMapping
	if err := db.Model(ProviderUserMapping{}).Find(&users, "provider_platform_id = ?", provId).Error; err != nil {
		log.Errorf("failed to fetch users: %v", err)
	}
	var programs []map[string]interface{}
	if err := db.Model(Program{}).Select("id, external_id").Find(&programs, "provider_platform_id = ?", provId).Error; err != nil {
		log.Errorf("failed to fetch programs: %v", err)
	}
	switch jt {
	case GetMilestonesJob:
		return map[string]interface{}{
			"user_mappings":        users,
			"programs":             programs,
			"provider_platform_id": provId,
			"job_type":             jt,
		}, nil
	case GetProgramsJob:
		return map[string]interface{}{
			"provider_platform_id": provId,
			"job_type":             jt,
		}, nil
	case GetActivityJob:
		return map[string]interface{}{
			"provider_platform_id": provId,
			"programs":             programs,
			"user_mappings":        users,
			"job_type":             jt,
		}, nil
	case GetOutcomesJob:
		return map[string]interface{}{
			"provider_platform_id": provId,
			"user_mappings":        users,
			"programs":             programs,
			"job_type":             jt,
		}, nil
	}
	return nil, nil
}

var AllDefaultJobs = []JobType{GetMilestonesJob, GetProgramsJob, GetActivityJob, GetOutcomesJob}

func NewCronJob(name JobType) *CronJob {
	return &CronJob{
		ID:       uuid.NewString(),
		Name:     string(name),
		Schedule: os.Getenv("MIDDLEWARE_CRON_SCHEDULE"),
	}
}
