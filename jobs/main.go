package main

import (
	"Go-Prototype/src/database"
	"Go-Prototype/src/models"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-co-op/gocron/v2"
	"github.com/joho/godotenv"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

const logPath = "./logs/jobs.log"

var Jobs = map[models.JobType]func() error{
	models.ImportUsers:      importUsers,
	models.ImportPrograms:   importPrograms,
	models.ImportMilestones: importMilestones,
}

func Run(db *gorm.DB, job *models.StoredJob) {
	if err := Jobs[job.JobType](); err != nil {
		afterError(db, job.ID, err)
		return
	} else {
		afterSuccess(db, job.ID)
		return
	}
}

func afterError(db *gorm.DB, id uint, err error) {
	txErr := db.Model(&models.ScheduledJob{}).Where("id = ?", id).Update("status", models.Failed).Update("error", err.Error()).Error
	if txErr != nil {
		log.Errorf("Failed to update job status to failed: %v", err)
	}
}

func afterSuccess(db *gorm.DB, id uint) {
	err := db.Model(&models.ScheduledJob{}).Where("id = ?", id).Update("status", models.Success).Update("last_run_time", time.Now()).Error
	if err != nil {
		log.Errorf("Failed to update job status to success: %v", err)
	}
}

func initLogging() {
	var file *os.File
	var err error
	prod := os.Getenv("APP_ENV") == "prod"
	if prod {
		file, err = os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			file, err = os.Create(logPath)
			if err != nil {
				log.Fatalf("Failed to open log file: %v", err)
			}
			log.SetFormatter(&log.JSONFormatter{})
		}
	} else {
		log.SetFormatter(&log.TextFormatter{ForceColors: true})
	}
	log.SetOutput(file)
}

func getJobsToRun(db *gorm.DB) ([]models.StoredJob, error) {
	var jobs []models.StoredJob
	err := db.Find(&jobs).Error
	return jobs, err
}

func runJobs(db *gorm.DB) {
	jobs, err := getJobsToRun(db)
	if err != nil {
		log.Errorf("Error getting jobs to run: %v", err)
		return
	}
	for _, job := range jobs {
		if updateErr := db.Model(&models.StoredJob{}).Where("id = ?", job.ID).Update("status", models.Running).Error; updateErr != nil {
			log.Errorf("Failed to update job status to running: %v", updateErr)
		}
		Run(db, &job)
	}
}

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Print("Error loading .env file, using default env vars")
	}
	initLogging()
	db := database.InitDB(false)
	db.Conn.AutoMigrate(&models.StoredJob{})

	s, _ := gocron.NewScheduler()
	defer func() { _ = s.Shutdown() }()

	job, err := s.NewJob(
		gocron.DailyJob(
			1,
			nil,
		),
		gocron.NewTask(
			func(db *gorm.DB) { runJobs(db) },
			db.Conn,
		),
	)
	if err != nil {
		log.Fatalf("Failed to create job: %v", err)
	}

	log.Printf("Job ID: %d", job.ID())

	s.Start()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	if err := s.Shutdown(); err != nil {
		fmt.Println("Failed to shutdown scheduler properly:", err)
		os.Exit(1)
	}
}
