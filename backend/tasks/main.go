package main

import (
	"UnlockEdv2/src/models"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/go-co-op/gocron/v2"
	"github.com/joho/godotenv"
	log "github.com/sirupsen/logrus"
)

func main() {
	err := godotenv.Load(".env")
	if err != nil {
		log.Error("error loading .env file, using the default env variables")
	}
	dev := os.Getenv("APP_ENV") == "dev"
	initLogging()
	runner := newJobRunner()
	scheduler, err := gocron.NewScheduler()
	if err != nil {
		log.Fatalf("Failed to create scheduler: %v", err)
		return
	}
	tasks, err := runner.generateTasks()
	if err != nil {
		log.Fatalf("failed to generate tasks: %v", err)
		return
	}
	hour := 1
	for _, task := range tasks {
		if task.Job == nil {
			log.Errorf("Task %v has no job", task.ID)
			continue
		}
		_, err := scheduler.NewJob(gocron.CronJob(getCronSchedule(&task, hour), false), gocron.NewTask(runner.runTask, &task))
		if err != nil {
			log.Errorf("Failed to create job: %v", err)
			continue
		}
		hour++
		if hour > 23 {
			hour = 1
		}
	}
	if !dev {
		runner.execute()
	}
	scheduler.Start()
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, syscall.SIGINT, syscall.SIGTERM)
	<-shutdown
}

func initLogging() {
	env := os.Getenv("APP_ENV")
	if env == "development" {
		log.SetFormatter(&log.TextFormatter{})
	} else {
		log.SetFormatter(&log.JSONFormatter{})
		level, err := log.ParseLevel(os.Getenv("LOG_LEVEL"))
		if err != nil {
			log.Error("Failed to parse log level, using default info")
			level = log.DebugLevel
		}
		log.SetLevel(level)
	}
}

func getCronSchedule(task *models.RunnableTask, hour int) string {
	if task.Provider != nil && task.Provider.Type == models.Brightspace {
		return fmt.Sprintf("0 %d * * 4", hour)
	} else if task.Job.Name == string(models.PutVideoMetadataJob) {
		return models.EverySundayAt8PM
	} else {
		return task.Job.Schedule
	}
}
