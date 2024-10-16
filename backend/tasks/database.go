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
	GetCourses    string        = "tasks.get_courses"
	GetActivity   string        = "tasks.get_activity"
	GetMilestones string        = "tasks.get_milestones"
	WaitTime      time.Duration = 5 * time.Minute
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

func (jr *JobRunner) createIfNotExists(cj models.JobType) (*models.CronJob, error) {
	job := models.CronJob{Name: string(cj)}
	if err := jr.db.Model(&models.CronJob{}).Where("name = ?", cj).FirstOrCreate(&job).Error; err != nil {
		log.Errorf("failed to find or create job: %v", err)
		return nil, err
	}
	log.Infof("CronJob %s has ID: %s", job.Name, job.ID)
	return &job, nil
}
