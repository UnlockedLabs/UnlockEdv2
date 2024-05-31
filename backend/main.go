package main

import (
	server "UnlockEdv2/src/handlers"
	"fmt"
	"net/http"
	"os"

	log "github.com/sirupsen/logrus"

	_ "github.com/jackc/pgx"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Info("no .env file found, using default env variables")
	}
	env := os.Getenv("APP_ENV")
	port := os.Getenv("APP_PORT")
	if port == "" {
		port = "8080"
	}
	testing := (env == "testing")
	initLogging(env)
	newServer := server.NewServer(testing)
	log.Info("Starting server on :", port)
	fmt.Println("Starting server on :", port)
	if err := http.ListenAndServe(":8080", server.CorsMiddleware(newServer.Mux)); err != nil {
		log.Fatalf("Error starting server: %v", err)
	}
}

func initLogging(env string) {
	var file *os.File
	var err error
	prod := (env == "prod" || env == "production")
	logLevel := os.Getenv("LOG_LEVEL")
	if prod {
		file, err = os.OpenFile("logs/server.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			log.Fatalf("Failed to open log file: %v", err)
		}
		if logLevel == "" {
			logLevel = "info"
		}
		log.SetFormatter(&log.JSONFormatter{})
	} else {
		if logLevel == "" {
			logLevel = "debug"
		}
		file = os.Stdout
		log.SetFormatter(&log.TextFormatter{ForceColors: true})
	}
	defer file.Close()
	level, err := log.ParseLevel(logLevel)
	if err != nil {
		log.Errorf("Error parsing log level: %v", err)
		level = log.InfoLevel
	}
	log.SetLevel(level)
	log.SetOutput(file)
}
