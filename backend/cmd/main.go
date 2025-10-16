package main

import (
	"UnlockEdv2/src/config"
	server "UnlockEdv2/src/handlers"
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/joho/godotenv"
	log "github.com/sirupsen/logrus"
)

func main() {
	// Load .env file (optional, for local development)
	// Docker Compose passes env vars directly, but local dev needs .env file
	if err := godotenv.Load("../.env"); err != nil {
		log.Info("no .env file found, using default env variables")
	}

	// Load and validate configuration FIRST
	// This will fail fast with clear messages if required variables are missing
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("❌ Configuration error:\n%v\n", err)
	}

	// Configure logging based on validated config
	initLogging(cfg.LogLevel)

	log.Printf("🚀 Starting server on %s (environment: %s)\n", cfg.AppURL, cfg.AppEnv)

	testing := (cfg.AppEnv == "testing")
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, syscall.SIGINT, syscall.SIGTERM)

	srv := server.NewServer(testing, ctx, cfg)
	go func() {
		sig := <-shutdown
		log.Infof("Received signal: %v. Initiating shutdown...", sig)
		cancel()
	}()

	srv.ListenAndServe(ctx)
}

func initLogging(level string) {
	log.SetFormatter(&log.JSONFormatter{})
	log.SetLevel(parseLogLevel(level))
}

func parseLogLevel(level string) log.Level {
	switch level {
	case "":
		return log.InfoLevel
	default:
		logLevel, err := log.ParseLevel(level)
		if err != nil {
			log.Errorf("Error parsing log level: %v", err)
			logLevel = log.InfoLevel
		}
		return logLevel
	}
}
