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

func (cj *CronJob) BeforeCreate(tx *gorm.DB) error {
	if len(cj.ID) == 0 {
		cj.ID = uuid.NewString()
	}
	if len(cj.Schedule) == 0 {
		cj.Schedule = os.Getenv("MIDDLEWARE_CRON_SCHEDULE")
	}
	return nil
}

type RunnableTask struct {
	ID                    uint                   `gorm:"primaryKey" json:"id"`
	JobID                 string                 `gorm:"size 50" json:"job_id"`
	Parameters            map[string]interface{} `gorm:"-" json:"parameters"`
	LastRun               time.Time              `json:"last_run"`
	ProviderPlatformID    *uint                  `json:"provider_platform_id"`
	OpenContentProviderID *uint                  `json:"open_content_provider_id"`
	Status                JobStatus              `json:"status"`

	Provider        *ProviderPlatform    `gorm:"foreignKey:ProviderPlatformID" json:"-"`
	ContentProvider *OpenContentProvider `gorm:"foreignKey:OpenContentProviderID" json:"-"`
	Job             *CronJob             `gorm:"foreignKey:JobID" json:"-"`
}

func (RunnableTask) TableName() string { return "runnable_tasks" }

const (
	GetMilestonesJob JobType = "get_milestones"
	GetCoursesJob    JobType = "get_courses"
	GetActivityJob   JobType = "get_activity"
	// GetOutcomesJob   JobType = "get_outcomes"

	ScrapeKiwixJob JobType = "scrape_kiwix"

	StatusPending JobStatus = "pending"
	StatusRunning JobStatus = "running"
)

// provider id can be nil pointer
func (jt JobType) GetParams(db *gorm.DB, provId *uint, jobId string) (map[string]interface{}, error) {
	var skip bool
	if jt == ScrapeKiwixJob {
		return map[string]interface{}{
			"open_content_provider_id": *provId,
			"job_id":                   jobId,
		}, nil
	}
	users := []map[string]interface{}{}
	if err := db.Model(ProviderUserMapping{}).Select("user_id, external_user_id").Joins("JOIN users u on provider_user_mappings.user_id = u.id").Find(&users, "provider_platform_id = ? AND u.role = 'student'", *provId).Error; err != nil {
		log.Errorf("failed to fetch users: %v", err)
		skip = true
	}
	courses := []map[string]interface{}{}
	if err := db.Model(Course{}).Select("id as course_id, external_id as external_course_id").Find(&courses, "provider_platform_id = ?", *provId).Error; err != nil {
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
			"provider_platform_id": *provId,
			"job_type":             jt,
			"job_id":               jobId,
		}, nil
	case GetCoursesJob:
		return map[string]interface{}{
			"provider_platform_id": provId,
			"job_type":             jt,
			"job_id":               jobId,
		}, nil
	case GetActivityJob:
		if skip {
			return nil, errors.New("no users or courses found for provider platform")
		}
		return map[string]interface{}{
			"provider_platform_id": *provId,
			"courses":              courses,
			"user_mappings":        users,
			"job_type":             jt,
			"job_id":               jobId,
		}, nil
		// case GetOutcomesJob:
		// 	if skip {
		// 		return nil, errors.New("no users or courses found for provider platform")
		// 	}
		// 	return map[string]interface{}{
		// 		"provider_platform_id": *provId,
		// 		"user_mappings":        users,
		// 		"courses":              courses,
		// 		"job_type":             jt,
		// 	}, nil
	}
	return nil, errors.New("job type not found")
}

var AllDefaultProviderJobs = []JobType{GetCoursesJob, GetMilestonesJob, GetActivityJob /* GetOutcomesJob */}
var AllOtherJobs = []JobType{ScrapeKiwixJob}

func NewCronJob(name JobType) *CronJob {
	return &CronJob{
		ID:       uuid.NewString(),
		Name:     string(name),
		Schedule: os.Getenv("MIDDLEWARE_CRON_SCHEDULE"),
	}
}
