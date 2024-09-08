package main

import (
	server "UnlockEdv2/src/handlers"
	"os"

	"github.com/joho/godotenv"
	log "github.com/sirupsen/logrus"
)

func main() {
	file := os.Stdout
	defer file.Close()
	if err := godotenv.Load(); err != nil {
		log.Info("no .env file found, using default env variables")
	}
	env := os.Getenv("APP_ENV")
	testing := (env == "testing")
	initLogging(env, file)
	newServer := server.NewServer(testing)
	newServer.ListenAndServe()
}

func initLogging(env string, file *os.File) {
	var err error
	prod := (env == "prod" || env == "production")
	if prod {
		file, err = os.OpenFile("logs/server.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			log.Fatalf("Failed to open log file: %v", err)
		}
		log.SetFormatter(&log.JSONFormatter{})
	} else {
		log.SetFormatter(&log.TextFormatter{ForceColors: true})
	}
	level := parseLogLevel()
	log.SetLevel(level)
	log.SetOutput(file)
}

func parseLogLevel() log.Level {
	level := os.Getenv("LOG_LEVEL")
	switch level {
	case "":
		return log.InfoLevel
	default:
		level, err := log.ParseLevel(level)
		if err != nil {
			log.Errorf("Error parsing log level: %v", err)
			level = log.InfoLevel
		}
		return level
	}
}
