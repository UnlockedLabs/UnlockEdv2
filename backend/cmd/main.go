package main

import (
	server "UnlockEdv2/src/handlers"
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/joho/godotenv"
	log "github.com/sirupsen/logrus"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Info("no .env file found, using default env variables")
	}
	env := os.Getenv("APP_ENV")
	testing := (env == "testing")
	initLogging()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, syscall.SIGINT, syscall.SIGTERM)

	srv := server.NewServer(testing, ctx)
	go func() {
		sig := <-shutdown
		log.Infof("Received signal: %v. Initiating shutdown...", sig)
		cancel()
	}()

	srv.ListenAndServe(ctx)
}

func initLogging() {
	log.SetFormatter(&log.JSONFormatter{})
	log.SetLevel(parseLogLevel())
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
