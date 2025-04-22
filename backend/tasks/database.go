package main

import (
	"UnlockEdv2/src/models"
	"fmt"
	"os"
	"time"

	log "github.com/sirupsen/logrus"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

const (
	WaitTime time.Duration = 5 * time.Minute
)

func initDB() *gorm.DB {
	log.Info("initializing database")
	dsn := os.Getenv("APP_DSN")
	if dsn == "" {
		dsn = fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=allow",
			os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"), os.Getenv("DB_NAME"))
	}
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN: dsn,
	}), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL database: %v", err)
	}
	log.Println("Connected to the PostgreSQL database")
	return db
}

func (jr *JobRunner) intoProviderPlatformTask(cj *models.CronJob, provId uint, task *models.RunnableTask) error {
	if err := jr.db.Model(&models.RunnableTask{}).
		Where(models.RunnableTask{ProviderPlatformID: &provId, JobID: cj.ID}).FirstOrCreate(&task).Error; err != nil {
		log.Errorf("failed to create task for job: %v. error: %v", cj.Name, err)
		return err
	}
	if err := jr.db.Model(&models.RunnableTask{}).Preload("Job").Preload("Provider").First(&task, task.ID).Error; err != nil {
		log.Errorf("failed to reload task for job: %v. error: %v", cj.Name, err)
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

func (jr *JobRunner) intoOpenContentTask(cj *models.CronJob, provId uint, task *models.RunnableTask) error {
	if task.ID == 0 {
		if err := jr.db.Preload("Job").Where("job_id = ? AND open_content_provider_id = ?", cj.ID, provId).FirstOrCreate(task).Error; err != nil {
			log.Errorln("failed to create non-provider task from cronjob")
			return err
		}
	}
	params, err := models.JobType(cj.Name).GetParams(jr.db, provId, cj.ID)
	if err != nil {
		log.Errorln("failed to get params for non-provider job")
		return err
	}
	task.Job = cj
	task.Parameters = params
	return nil
}

func (jr *JobRunner) intoGeneralTask(cj *models.CronJob, task *models.RunnableTask) error {
	if task.ID == 0 {
		if err := jr.db.Preload("Job").Where("job_id = ?", cj.ID).FirstOrCreate(task).Error; err != nil {
			log.Errorln("failed to create general task from cronjob")
			return err
		}
	}
	task.Job = cj
	return nil
}

func (jr *JobRunner) createIfNotExists(cj models.JobType) (*models.CronJob, error) {
	job := models.CronJob{Name: string(cj)}
	if err := jr.db.Model(&models.CronJob{}).Where("name = ?", cj).FirstOrCreate(&job).Error; err != nil {
		log.Errorf("failed to find or create job: %v", err)
		return nil, err
	}
	log.Infof("CronJob %s has ID: %s", job.Name, job.ID)
	return &job, nil
}

func (jr *JobRunner) handleCreateOCProviderTask(job *models.CronJob, providerId uint) (*models.RunnableTask, error) {
	if err := jr.db.Model(&models.CronJob{}).Preload("Tasks").Where("name = ?", string(job.Name)).FirstOrCreate(&job).Error; err != nil {
		log.Errorf("failed to create job: %v", err)
		return nil, err
	}
	task := models.RunnableTask{}
	if len(job.Tasks) > 0 {
		log.Infof("Job %s already has a task with id: %d", job.Name, job.Tasks[0].ID)
		task = job.Tasks[0]
	} else {
		task = models.RunnableTask{OpenContentProviderID: &providerId, JobID: job.ID, Status: models.StatusPending}
	}
	if err := jr.intoOpenContentTask(job, providerId, &task); err != nil {
		log.Errorf("failed to create task: %v", err)
		return nil, err
	}
	return &task, nil
}
