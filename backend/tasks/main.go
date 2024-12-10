package main

import (
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
		log.Error("error loading .env file, using default env variables")
	}
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
	for _, task := range tasks {
		if task.Job == nil {
			log.Errorf("Task %v has no job", task.ID)
			continue
		}
		_, err := scheduler.NewJob(gocron.CronJob(task.Job.Schedule, false), gocron.NewTask(runner.runTask, &task))
		if err != nil {
			log.Errorf("Failed to create job: %v", err)
			continue
		}
	}
	runner.execute()
	scheduler.Start()
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, syscall.SIGINT, syscall.SIGTERM)
	<-shutdown
}

func initLogging() {
	env := os.Getenv("APP_ENV")
	var err error
	var file *os.File
	if env == "development" {
		log.SetFormatter(&log.TextFormatter{})
		file = os.Stdout
	} else {
		log.SetFormatter(&log.JSONFormatter{})
		file, err = os.OpenFile("logs/cron.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			log.Error("Failed to log to file, using default stderr")
			file = os.Stdout
		}
	}
	log.SetOutput(file)
	level, err := log.ParseLevel(os.Getenv("LOG_LEVEL"))
	if err != nil {
		log.Error("Failed to parse log level, using default info")
		level = log.DebugLevel
	}
	log.SetLevel(level)
}
