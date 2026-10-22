package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/UnlockedLabs/unlocked-core/backend/src/database"
	server "github.com/UnlockedLabs/unlocked-core/backend/src/handlers"
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/registry"
	"github.com/UnlockedLabs/unlocked-core/backend/src/tasks"

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
	go cancelOnSignal(shutdown, cancel)

	// `backend scheduler` runs the background jobs; anything else (including
	// the "./backend" argument the charts pass) runs the API server.
	if len(os.Args) > 1 && os.Args[1] == "scheduler" {
		runScheduler(ctx, env == "dev")
		return
	}
	srv := server.NewServer(testing, ctx)
	if srv == nil {
		log.Info("Server stopped before migrations finished")
		return
	}
	srv.ListenAndServe(ctx)
}

func cancelOnSignal(shutdown <-chan os.Signal, cancel context.CancelFunc) {
	sig := <-shutdown
	log.Infof("Received signal: %v. Initiating shutdown...", sig)
	cancel()
}

// runScheduler schedules every background job and publishes each one to NATS
// when it's due; provider-middleware does the work. It runs until ctx is
// canceled. It doesn't migrate: it waits until the database is migrated.
func runScheduler(ctx context.Context, dev bool) {
	nc, err := server.ConnectNATS()
	if err != nil {
		log.Fatalf("Failed to connect to NATS: %v", err)
	}
	defer nc.Close()
	db := database.Connect()
	sqlDB, err := db.DB.DB()
	if err != nil {
		log.Fatalf("Failed to get database connection: %v", err)
	}
	if !database.WaitForMigrations(ctx, sqlDB) {
		log.Info("Scheduler stopped before migrations finished")
		return
	}
	mods := registry.All()
	s := tasks.Start(dev, nc, db.DB, mods)
	log.Info("Scheduler started")
	<-ctx.Done()
	if err := s.Stop(); err != nil {
		log.Errorf("Error stopping scheduler: %v", err)
	}
	log.Info("Scheduler stopped")
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
