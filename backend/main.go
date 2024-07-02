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
	file := os.Stdout
	defer file.Close()
	if err := godotenv.Load(); err != nil {
		log.Info("no .env file found, using default env variables")
	}
	env := os.Getenv("APP_ENV")
	port := os.Getenv("APP_PORT")
	if port == "" {
		port = "8080"
	}
	testing := (env == "testing")

	initLogging(env, file)
	newServer := server.NewServer(testing)
	fmt.Println("Starting server on :", port)
	log.Info("LOG_LEVEL: ", log.GetLevel())
	if err := http.ListenAndServe(":8080", server.CorsMiddleware(newServer.Mux)); err != nil {
		log.Fatalf("Error starting server: %v", err)
	}
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
