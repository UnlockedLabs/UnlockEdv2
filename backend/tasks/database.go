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

func (jr *JobRunner) createIfNotExists(cj *models.CronJob, prov *models.ProviderPlatform) (string, error) {
	existing := models.CronJob{}
	if err := jr.db.Model(models.CronJob{}).First(&existing, "name = ?", cj.Name).Error; err == nil {
		return existing.ID, nil
	}
	if err := jr.db.Create(cj).Error; err != nil {
		log.Errorf("Failed to create cron job %s: %v", cj.Name, err)
		return "", err
	}
	err := jr.checkFirstRun(prov)
	if err != nil {
		return "", err
	}
	return cj.ID, nil
}

func (jr *JobRunner) checkFirstRun(prov *models.ProviderPlatform) error {
	var courses []models.Course
	if err := jr.db.Find(&courses, "provider_platform_id = ?", prov.ID).Error; err != nil {
		log.Errorf("failed to fetch courses: %v", err)
		return err
	}
	if len(courses) == 0 {
		done := make(chan bool)

		params := map[string]interface{}{
			"provider_platform_id": prov.ID,
		}
		jobs := prov.GetDefaultCronJobs()
		var courseJob *models.CronJob
		for _, job := range jobs {
			if job.Name == string(models.GetCoursesJob) {
				courseJob = job
				break
			}
		}

		if err := jr.db.Create(&models.RunnableTask{
			JobID:      courseJob.ID,
			Parameters: params,
			Status:     models.StatusPending,
		}).Error; err != nil {
			log.Errorf("failed to create task: %v", err)
			return err
		}

		sub, err := jr.nats.Subscribe("tasks.get_courses.completed", func(msg *nats.Msg) {
			var completedParams map[string]interface{}
			if err := json.Unmarshal(msg.Data, &completedParams); err != nil {
				log.Errorf("failed to unmarshal completion message: %v", err)
				return
			}
			if completedParams["job_id"] == courseJob.ID {
				done <- true
			}
		})
		if err != nil {
			log.Errorf("failed to subscribe to completion subject: %v", err)
			return err
		}
		defer func() {
			err := sub.Unsubscribe()
			if err != nil {
				log.Errorf("failed to unsubscribe from completion subject: %v", err)
			}
		}()

		params["job_id"] = courseJob.ID
		body, err := json.Marshal(&params)
		if err != nil {
			log.Errorf("failed to marshal params: %v", err)
			return err
		}
		msg := nats.NewMsg("tasks.get_courses")
		msg.Data = body
		err = jr.nats.PublishMsg(msg)
		if err != nil {
			log.Errorf("failed to publish message to get courses: %v", err)
			return err
		}
		log.Info("published message to get courses")

		select {
		case <-done:
			log.Info("Course fetching job completed. Continuing with the rest of the jobs...")
		case <-time.After(3 * time.Minute):
			log.Error("Timeout waiting for course fetching job to complete")
			return fmt.Errorf("timeout waiting for course fetching job to complete")
		}
	}
	return nil
}
