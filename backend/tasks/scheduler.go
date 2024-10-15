package main

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"os"
	"sync"

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

func (jr *JobRunner) generateTasks() ([]models.RunnableTask, error) {
	allTasks := make([]models.RunnableTask, 0)
	if otherTasks, err := jr.generateOpenContentProviderTasks(); err == nil {
		allTasks = append(allTasks, otherTasks...)
	} else {
		log.Println("Failed to generate other tasks")
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
	var id *uint
	for _, jobType := range models.AllOtherJobs {
		job := models.CronJob{Name: string(jobType)}
		switch jobType {
		case models.ScrapeKiwixJob:
			if err := jr.db.Model(&models.OpenContentProvider{}).Select("id").Where("name = ?", models.Kiwix).Scan(&id).Error; err != nil {
				log.Errorf("failed to fetch kiwix provider: %v", err)
				continue
			}
			if err := jr.db.Model(&models.CronJob{}).Where("name = ?", string(job.Name)).FirstOrCreate(&job).Error; err != nil {
				log.Errorf("failed to create job: %v", err)
				continue
			}
		default:
			continue
		}
		task := models.RunnableTask{OpenContentProviderID: id, JobID: job.ID}
		if err := jr.intoOpenContentTask(&job, id, &task); err != nil {
			log.Errorf("failed to create task: %v", err)
			return nil, err
		}
		otherTasks = append(otherTasks, task)
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
		provJobs := provider.GetDefaultCronJobs()
		for idx := range provJobs {
			log.Infof("Checking job: %v", provJobs[idx])
			created, err := jr.createIfNotExists(models.JobType(provJobs[idx]))
			if err != nil {
				log.Errorf("failed to create job: %v", err)
				return nil, err
			}
			newTask := models.RunnableTask{JobID: created.ID, ProviderPlatformID: &provider.ID, Status: models.StatusPending}
			err = jr.intoProviderPlatformTask(created, &provider.ID, &newTask)
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

func (jr *JobRunner) intoProviderPlatformTask(cj *models.CronJob, provId *uint, task *models.RunnableTask) error {
	if err := jr.db.Model(&models.RunnableTask{}).Preload("Job").Where(models.RunnableTask{ProviderPlatformID: provId, JobID: cj.ID}).FirstOrCreate(&task).Error; err != nil {
		log.Errorf("failed to create task for job: %v. error: %v", cj.Name, err)
		return err
	}
	params, err := models.JobType(cj.Name).GetParams(jr.db, provId, cj.ID)
	if err != nil {
		log.Errorf("failed to get params for job: %v", err)
		return err
	}
	task.Parameters = params
	return nil
}

func (jr *JobRunner) intoOpenContentTask(cj *models.CronJob, provId *uint, task *models.RunnableTask) error {
	if err := jr.db.Model(&models.RunnableTask{}).Preload("Job").Where("job_id = ? AND open_content_provider_id = ?", cj.ID, provId).FirstOrCreate(&task).Error; err != nil {
		log.Errorln("failed to create non-provider task from cronjob")
		return err
	}
	params, err := models.JobType(cj.Name).GetParams(jr.db, provId, cj.ID)
	if err != nil {
		log.Errorln("failed to get params for non-provider job")
		return err
	}
	task.Parameters = params
	return nil
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
