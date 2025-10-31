package models

import (
	"slices"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type (
	CronJob struct {
		ID        string    `gorm:"primaryKey" json:"id"`
		Name      string    `gorm:"size 60" json:"name"`
		Schedule  string    `gorm:"size 60" json:"schedule"`
		Category  int       `json:"category"`
		CreatedAt time.Time `json:"created_at"`

		Tasks []RunnableTask `gorm:"foreignKey:JobID;references:ID" json:"-"`
	}
	JobType   string
	JobStatus string
)

func (CronJob) TableName() string { return "cron_jobs" }

func (cj *CronJob) BeforeCreate(tx *gorm.DB) error {
	if len(cj.ID) == 0 {
		cj.ID = uuid.NewString()
	}
	if slices.Contains(AllContentProviderJobs, JobType(cj.Name)) {
		cj.Category = OpenContentJob
	} else if slices.Contains(AllDefaultProviderJobs, JobType(cj.Name)) {
		cj.Category = ProviderPlatformJob
	}
	if len(cj.Schedule) == 0 && cj.Name == string(RetryVideoDownloadsJob) {
		cj.Schedule = EveryDaytimeHour
	}
	return nil
}

type RunnableTask struct {
	ID                    uint           `gorm:"primaryKey" json:"id"`
	JobID                 string         `gorm:"size 50" json:"job_id"`
	Parameters            map[string]any `gorm:"-" json:"parameters"`
	LastRun               time.Time      `json:"last_run"`
	ProviderPlatformID    *uint          `json:"provider_platform_id"`
	OpenContentProviderID *uint          `json:"open_content_provider_id"`
	Status                JobStatus      `json:"status"`

	Provider        *ProviderPlatform    `gorm:"foreignKey:ProviderPlatformID" json:"-"`
	ContentProvider *OpenContentProvider `gorm:"foreignKey:OpenContentProviderID" json:"-"`
	Job             *CronJob             `gorm:"foreignKey:JobID" json:"-"`
}

func (task *RunnableTask) Prepare(provId *uint) {
	if task.Parameters == nil {
		task.Parameters = make(map[string]any)
	}
	if task.Job != nil {
		task.Parameters["job_type"] = task.Job.Name
		task.Parameters["job_id"] = task.Job.ID
	}
	if provId != nil {
		if slices.Contains(AllDefaultProviderJobs, JobType(task.Job.Name)) || task.Job.Category == ProviderPlatformJob {
			task.Parameters["provider_platform_id"] = provId
		} else if slices.Contains(AllContentProviderJobs, JobType(task.Job.Name)) || task.Job.Category == OpenContentJob {
			task.Parameters["open_content_provider_id"] = provId
		}
	}
}

func (RunnableTask) TableName() string { return "runnable_tasks" }

const (
	ProviderPlatformJob = 1
	OpenContentJob      = 2

	GetMilestonesJob JobType = "get_milestones"
	GetCoursesJob    JobType = "get_courses"
	GetActivityJob   JobType = "get_activity"

	ScrapeKiwixJob         JobType   = "scrape_kiwix"
	RetryVideoDownloadsJob JobType   = "retry_video_downloads"
	RetryManualDownloadJob JobType   = "retry_manual_download"
	SyncVideoMetadataJob   JobType   = "sync_video_metadata"
	AddVideosJob           JobType   = "add_videos"
	EveryDaytimeHour       string    = "0 6-20 * * *"
	EverySundayAt8PM       string    = "0 20 * * 6"
	StatusPending          JobStatus = "pending"
	StatusRunning          JobStatus = "running"
)

var AllDefaultProviderJobs = []JobType{GetCoursesJob, GetMilestonesJob, GetActivityJob}
var AllContentProviderJobs = []JobType{ScrapeKiwixJob, RetryVideoDownloadsJob, SyncVideoMetadataJob}

func (jt JobType) IsVideoJob() bool {
	switch jt {
	case RetryVideoDownloadsJob, SyncVideoMetadataJob:
		return true
	}
	return false
}

func (jt JobType) IsLibraryJob() bool {
	switch jt {
	case ScrapeKiwixJob:
		return true
	}
	return false
}

func (jt JobType) PubName() string {
	return "tasks." + string(jt)
}
