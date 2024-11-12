package main

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"os"

	"github.com/nats-io/nats.go"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type JobRunner struct {
	nats *nats.Conn
	db   *gorm.DB
}

func newJobRunner() *JobRunner {
	db := initDB()
	options := nats.GetDefaultOptions()
	options.Url = os.Getenv("NATS_URL")
	options.AllowReconnect = true
	options.Password = os.Getenv("NATS_PASSWORD")
	options.User = os.Getenv("NATS_USER")
	conn, err := options.Connect()
	if err != nil {
		log.Fatalf("Failed to connect to NATS: %v", err)
	}
	runner := JobRunner{nats: conn, db: db}
	return &runner
}

func (jr *JobRunner) generateTasks() ([]models.RunnableTask, error) {
	allTasks := make([]models.RunnableTask, 0)
	if otherTasks, err := jr.generateOpenContentProviderTasks(); err == nil {
		allTasks = append(allTasks, otherTasks...)
	} else {
		log.Println("Failed to generate open content provider tasks")
	}
	if providerTasks, err := jr.generateProviderTasks(); err == nil {
		allTasks = append(allTasks, providerTasks...)
	} else {
		log.Println("Failed to generate provider tasks")
	}
	return allTasks, nil
}

func (jr *JobRunner) generateOpenContentProviderTasks() ([]models.RunnableTask, error) {
	otherTasks := make([]models.RunnableTask, 0)
	providers := make([]models.OpenContentProvider, 0)
	if err := jr.db.Find(&providers, "currently_enabled = true").Error; err != nil {
		log.Errorf("failed to fetch all open content providers: %v", err)
		return nil, err
	}
	for idx := range providers {
		for _, jobType := range models.AllContentProviderJobs {
			switch jobType {
			case models.ScrapeKiwixJob:
				job := models.CronJob{Name: string(jobType)}
				if providers[idx].Name == models.Kiwix {
					task, err := jr.handleCreateOCProviderTask(&job, providers[idx].ID)
					if err != nil {
						log.Errorf("failed to create task: %v", err)
						continue
					}
					otherTasks = append(otherTasks, *task)
				}
			case models.RetryVideoDownloadsJob, models.SyncVideoMetadataJob:
				job := models.CronJob{Name: string(jobType)}
				if providers[idx].Name == models.Youtube {
					task, err := jr.handleCreateOCProviderTask(&job, providers[idx].ID)
					if err != nil {
						log.Errorf("failed to create task: %v", err)
						continue
					}
					otherTasks = append(otherTasks, *task)
				}
			default:
				continue
			}
		}
	}
	return otherTasks, nil
}

func (jr *JobRunner) generateProviderTasks() ([]models.RunnableTask, error) {
	var providers []models.ProviderPlatform
	if err := jr.db.Find(&providers, "state = 'enabled'").Error; err != nil {
		log.Errorln("failed to fetch all provider platforms")
		return nil, err
	}
	log.Infof("Found %d active providers", len(providers))
	tasksToRun := make([]models.RunnableTask, 0)
	for _, provider := range providers {
		var courses []models.Course
		if err := jr.db.Find(&courses, "provider_platform_id = ?", provider.ID).Error; err != nil {
			log.Errorf("failed to fetch courses for provider %d: %v", provider.ID, err)
			continue
		}
		firstRun := false
		if len(courses) == 0 {
			getCoursesJob, err := jr.createIfNotExists(models.GetCoursesJob)
			if err != nil {
				log.Errorf("failed to create GetCoursesJob: %v", err)
				continue
			}
			getCoursesTask := models.RunnableTask{JobID: getCoursesJob.ID, ProviderPlatformID: &provider.ID, Status: models.StatusPending}
			err = jr.intoProviderPlatformTask(getCoursesJob, provider.ID, &getCoursesTask)
			if err != nil {
				log.Errorf("failed to create GetCoursesTask: %v", err)
				continue
			}
			firstRun = true
			err = jr.fetchInitialProviderCourses(&provider, getCoursesJob.ID, &getCoursesTask)
			if err != nil {
				log.Errorf("failed to fetch initial provider courses: %v", err)
				continue
			}
		}
		provJobs := provider.GetDefaultCronJobs()
		for _, jobType := range provJobs {
			if jobType == models.GetCoursesJob && firstRun {
				continue
			}
			created, err := jr.createIfNotExists(jobType)
			if err != nil {
				log.Errorf("failed to create job: %v", err)
				return nil, err
			}
			newTask := models.RunnableTask{JobID: created.ID, ProviderPlatformID: &provider.ID, Status: models.StatusPending}
			err = jr.intoProviderPlatformTask(created, provider.ID, &newTask)
			if err != nil {
				log.Errorf("failed to create task: %v", err)
				return nil, err
			}
			tasksToRun = append(tasksToRun, newTask)
		}
	}
	log.Infof("Generated %d total tasks for %d providers", len(tasksToRun), len(providers))
	return tasksToRun, nil
}

func (jr *JobRunner) runTask(task *models.RunnableTask) {
	// publish the task to the nats server, update the satus of the task to 'running'
	task.Parameters["last_run"] = task.LastRun
	task.Parameters["job"] = task.JobID
	jobType := task.Parameters["job_type"].(models.JobType)
	params, err := json.Marshal(task.Parameters)
	if err != nil {
		log.Errorf("failed to marshal params: %v", err)
		return
	}
	task.Status = models.StatusRunning
	if err := jr.db.Save(task).Error; err != nil {
		log.Errorf("failed to update task status: %v", err)
		return
	}
	msg := nats.NewMsg(jobType.PubName())
	msg.Data = params
	if err := jr.nats.PublishMsg(msg); err != nil {
		log.Errorf("failed to publish job: %v", err)
		return
	}
	log.Info("Published job: ", jobType)
}

func (jr *JobRunner) execute() {
	tasks, err := jr.generateTasks()
	if err != nil {
		log.Errorf("failed to generate tasks: %v", err)
		return
	}
	log.Infof("Generated %v tasks", tasks)
	for _, task := range tasks {
		log.Infof("Running task: %v", task.Job.Name)
		jr.runTask(&task)
	}
}
