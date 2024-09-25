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
	runner := getRunner()
	scheduler, err := gocron.NewScheduler()
	if err != nil {
		log.Fatalf("Failed to create scheduler: %v", err)
		return
	}
	newJob, err := scheduler.NewJob(gocron.CronJob(os.Getenv("MIDDLEWARE_CRON_SCHEDULE"), false), gocron.NewTask(runner.execute))
	if err != nil {
		log.Fatalf("Failed to create job: %v", err)
	}
	scheduler.Start()
	err = newJob.RunNow()
	if err != nil {
		log.Errorln("Failed to run job now: ", err)
	}
	log.Infof("Scheduler started, running %s", newJob.ID())
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
