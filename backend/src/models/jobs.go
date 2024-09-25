package models

import (
	"errors"
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

		Tasks []*RunnableTask `gorm:"foreignKey:JobID;references:ID" json:"-"`
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

	Provider *ProviderPlatform `gorm:"foreignKey:ProviderPlatformID" json:"-"`
	Job      *CronJob          `gorm:"foreignKey:JobID" json:"-"`
}

func (RunnableTask) TableName() string { return "runnable_tasks" }

const (
	GetMilestonesJob JobType = "get_milestones"
	GetCoursesJob    JobType = "get_courses"
	GetActivityJob   JobType = "get_activity"
	// GetOutcomesJob   JobType = "get_outcomes"

	StatusPending JobStatus = "pending"
	StatusRunning JobStatus = "running"
)

func (jt JobType) GetParams(db *gorm.DB, provId uint) (map[string]interface{}, error) {
	var skip bool
	users := []map[string]interface{}{}
	if err := db.Model(ProviderUserMapping{}).Select("user_id, external_user_id").Find(&users, "provider_platform_id = ?", provId).Error; err != nil {
		log.Errorf("failed to fetch users: %v", err)
		skip = true
	}
	courses := []map[string]interface{}{}
	if err := db.Model(Course{}).Select("id as course_id, external_id as external_course_id").Find(&courses, "provider_platform_id = ?", provId).Error; err != nil {
		log.Errorf("failed to fetch courses: %v", err)
		skip = true
	}
	switch jt {
	case GetMilestonesJob:
		if skip {
			return nil, errors.New("no users or courses found for provider platform")
		}
		return map[string]interface{}{
			"user_mappings":        users,
			"courses":              courses,
			"provider_platform_id": provId,
			"job_type":             jt,
		}, nil
	case GetCoursesJob:
		return map[string]interface{}{
			"provider_platform_id": provId,
			"job_type":             jt,
		}, nil
	case GetActivityJob:
		if skip {
			return nil, errors.New("no users or courses found for provider platform")
		}
		return map[string]interface{}{
			"provider_platform_id": provId,
			"courses":              courses,
			"user_mappings":        users,
			"job_type":             jt,
		}, nil
		// case GetOutcomesJob:
		// 	if skip {
		// 		return nil, errors.New("no users or courses found for provider platform")
		// 	}
		// 	return map[string]interface{}{
		// 		"provider_platform_id": provId,
		// 		"user_mappings":        users,
		// 		"courses":              courses,
		// 		"job_type":             jt,
		// 	}, nil
	}
	return nil, nil
}

var AllDefaultJobs = []JobType{GetCoursesJob, GetMilestonesJob, GetActivityJob /* GetOutcomesJob */}

func NewCronJob(name JobType) *CronJob {
	return &CronJob{
		ID:       uuid.NewString(),
		Name:     string(name),
		Schedule: os.Getenv("MIDDLEWARE_CRON_SCHEDULE"),
	}
}
