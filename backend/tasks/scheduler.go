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

var getRunner = sync.OnceValue[*JobRunner](func() *JobRunner { return newJobRunner() })

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
		for _, job := range provJobs {
			log.Infof("Checking job: %v", job)
			jobId, err := jr.createIfNotExists(job, &provider)
			if err != nil {
				log.Errorf("failed to create job: %v", err)
				return nil, err
			}
			job.ID = jobId // dedupe
			task, err := jr.intoTask(&provider, job)
			if err != nil {
				log.Errorf("failed to create task: %v", err)
				return nil, err
			}
			log.Debugf("generated task: %v", task)
			tasksToRun = append(tasksToRun, *task)
		}
		log.Debugf("Generated %d tasks for provider: ", len(tasksToRun), provider.Name)
	}
	log.Infof("Generated %d tasks", len(tasksToRun))
	return tasksToRun, nil
}

func (jr *JobRunner) intoTask(prov *models.ProviderPlatform, cj *models.CronJob) (*models.RunnableTask, error) {
	task := models.RunnableTask{}
	if err := jr.db.Model(models.RunnableTask{}).First(&task, "provider_platform_id = ? AND job_id = ?", prov.ID, cj.ID).Error; err != nil {
		log.Errorf("failed to fetch existing task: %v", err)
		// this is the first run
		task = models.RunnableTask{
			ProviderPlatformID: prov.ID,
			JobID:              cj.ID,
			Status:             models.StatusPending,
			// on first run, we fetch all the data a course would have
			LastRun:  time.Now().AddDate(0, -6, 0),
			Schedule: cj.Schedule,
		}
	}
	if err := jr.db.Save(&task).Error; err != nil {
		log.Errorf("failed to save task: %v", err)
		return nil, err
	}
	params, err := models.JobType(cj.Name).GetParams(jr.db, prov.ID)
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
	log.Info("Published job: ", jobType, " with params: ", string(params))
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
