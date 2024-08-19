package main

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/nats-io/nats.go"
	log "github.com/sirupsen/logrus"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func initDB() *gorm.DB {
	log.Info("initializing database")
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=allow",
		os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"), os.Getenv("DB_NAME"))
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN: dsn,
	}), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL database: %v", err)
	}
	log.Println("Connected to the PostgreSQL database")
	return db
}

func (jr *JobRunner) createIfNotExists(cj *models.CronJob, prov *models.ProviderPlatform) error {
	existing := models.CronJob{}
	if err := jr.db.First(&existing, "name = ?", cj.Name).Error; err == nil {
		return nil
	}
	if err := jr.db.Create(cj).Error; err != nil {
		log.Errorf("Failed to create cron job %s: %v", cj.Name, err)
		return err
	}
	jr.checkFirstRun(prov)
	return nil
}

func (jr *JobRunner) checkFirstRun(prov *models.ProviderPlatform) error {
	var programs []models.Program
	if err := jr.db.Find(&programs, "provider_platform_id = ?", prov.ID).Error; err != nil {
		log.Errorf("failed to fetch programs: %v", err)
		return err
	}
	if len(programs) == 0 {
		done := make(chan bool)

		params := map[string]interface{}{
			"provider_platform_id": prov.ID,
		}
		jobs := prov.GetDefaultCronJobs()
		var programJob *models.CronJob
		for _, job := range jobs {
			if job.Name == string(models.GetProgramsJob) {
				programJob = job
				break
			}
		}

		if err := jr.db.Create(&models.RunnableTask{
			JobID:      programJob.ID,
			Parameters: params,
			Status:     models.StatusPending,
			Schedule:   programJob.Schedule,
		}).Error; err != nil {
			log.Errorf("failed to create task: %v", err)
			return err
		}

		sub, err := jr.nats.Subscribe("tasks.get_programs.completed", func(msg *nats.Msg) {
			var completedParams map[string]interface{}
			if err := json.Unmarshal(msg.Data, &completedParams); err != nil {
				log.Errorf("failed to unmarshal completion message: %v", err)
				return
			}
			if completedParams["job_id"] == programJob.ID {
				done <- true
			}
		})
		if err != nil {
			log.Errorf("failed to subscribe to completion subject: %v", err)
			return err
		}
		defer sub.Unsubscribe()

		params["job_id"] = programJob.ID
		body, err := json.Marshal(&params)
		if err != nil {
			log.Errorf("failed to marshal params: %v", err)
			return err
		}
		msg := nats.NewMsg("tasks.get_programs")
		msg.Data = body
		jr.nats.PublishMsg(msg)
		log.Info("published message to get programs")

		select {
		case <-done:
			log.Info("Program fetching job completed. Continuing with the rest of the jobs...")
		case <-time.After(3 * time.Minute):
			log.Error("Timeout waiting for program fetching job to complete")
			return fmt.Errorf("timeout waiting for program fetching job to complete")
		}
	}
	return nil
}
