package main

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type JobRunner struct {
	nats *nats.Conn
	db   *gorm.DB
}

var getRunner = sync.OnceValue(func() *JobRunner { return newJobRunner() })

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

var otherJobs = []string{"scrape_kiwix"}

func (jr *JobRunner) generateTasks() ([]models.RunnableTask, error) {
	allTasks := make([]models.RunnableTask, 0)
	if otherTasks, err := jr.generateOtherTasks(); err == nil {
		allTasks = append(allTasks, otherTasks...)
	} else {
		log.Println("Failed to generate other tasks")
	}
	providerTasks, err := jr.generateProviderTasks()
	if err == nil {
		allTasks = append(allTasks, providerTasks...)
	} else {
		log.Println("Failed to generate provider tasks")
	}

	return allTasks, nil
}

func (jr *JobRunner) generateOtherTasks() ([]models.RunnableTask, error) {
	otherTasks := make([]models.RunnableTask, 0)
	for _, task := range otherJobs {
		job := models.CronJob{}
		if err := jr.db.Model(&models.CronJob{}).Where("name = ?", task).FirstOrCreate(&job).Error; err != nil {
			log.Errorf("failed to create job: %v", err)
			continue
		}
		task, err := jr.intoTask(nil, &job)
		if err != nil {
			log.Errorf("failed to create task: %v", err)
			continue
		}
		otherTasks = append(otherTasks, *task)
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
	// TODO: make this dynamic, but for now all providers use the same jobs
	var tasksToRun []models.RunnableTask
	for _, provider := range providers {
		provJobs := provider.GetDefaultCronJobs()
		log.Debug("provJobs: ", provJobs)
		for idx := range provJobs {
			log.Infof("Checking job: %v", provJobs[idx])
			if err := jr.createIfNotExists(provJobs[idx], &provider); err != nil {
				log.Errorf("failed to create job: %v", err)
				return nil, err
			}
			task, err := jr.intoTask(&provider.ID, provJobs[idx])
			if err != nil {
				log.Errorf("failed to create task: %v", err)
				return nil, err
			}
			log.Debugf("generated task: %v", task)
			tasksToRun = append(tasksToRun, *task)
		}
	}
	log.Infof("Generated %d total tasks for %d providers", len(tasksToRun), len(providers))
	return tasksToRun, nil
}

func (jr *JobRunner) intoTask(prov *uint, cj *models.CronJob) (*models.RunnableTask, error) {
	task := models.RunnableTask{}
	if !models.JobType(cj.Name).IsProviderJob() {
		// look up open content provider id

		// these jobs don't reference a provider platform: so prov will be nil
		if err := jr.db.Model(&models.RunnableTask{}).Where("job_id = ?", &task).FirstOrCreate(&task).Error; err != nil {
			log.Errorln("failed to create non-provider task from cronjob")
			return nil, err
		}
		params, err := models.JobType(cj.Name).GetParams(jr.db, nil)
		if err != nil {
			log.Errorln("failed to get params for non-provider job")
			return nil, err
		}
		params["job_id"] = cj.ID
		task.Parameters = params
		return &task, nil
	}
	err := jr.db.Model(&models.RunnableTask{}).First(&task, "provider_platform_id = ? AND job_id = ?", prov, cj.ID).Error
	if err != nil {
		// Record not found, create a new task
		task = models.RunnableTask{
			ProviderPlatformID: *prov,
			JobID:              cj.ID,
			Status:             models.StatusPending,
			LastRun:            time.Now().AddDate(0, -6, 0),
		}
		if err := jr.db.Create(&task).Error; err != nil {
			log.Errorf("failed to create task: %v", err)
			return nil, err
		}
	}
	params, err := models.JobType(cj.Name).GetParams(jr.db, prov)
	if err != nil {
		log.Errorf("failed to get params for job: %v", err)
		return nil, err
	}
	params["job_id"] = cj.ID
	task.Parameters = params
	return &task, nil
}

func (jr *JobRunner) runTask(task *models.RunnableTask) error {
	log.Info("Running task: ", task)
	// publish the task to the nats server, update the satus of the task to 'running'
	task.Parameters["last_run"] = task.LastRun
	task.Parameters["job"] = task.JobID
	jobType := task.Parameters["job_type"].(models.JobType)
	params, err := json.Marshal(task.Parameters)
	if err != nil {
		log.Errorf("failed to marshal params: %v", err)
		return err
	}
	task.Status = models.StatusRunning
	if err := jr.db.Save(task).Error; err != nil {
		log.Errorf("failed to update task status: %v", err)
		return err
	}
	msg := nats.NewMsg(fmt.Sprintf("tasks.%s", string(jobType)))
	msg.Data = params
	if err := jr.nats.PublishMsg(msg); err != nil {
		log.Errorf("failed to publish job: %v", err)
		return err
	}
	log.Info("Published job: ", jobType)
	return nil
}

func (jr *JobRunner) execute() {
	tasks, err := jr.generateTasks()
	if err != nil {
		log.Errorf("failed to generate tasks: %v", err)
		return
	}
	for _, task := range tasks {
		if err := jr.runTask(&task); err != nil {
			log.Errorf("failed to run task: %v", err)
		}
	}
}
