package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/UnlockedLabs/unlocked-core/backend/src/database"
	server "github.com/UnlockedLabs/unlocked-core/backend/src/handlers"
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/registry"
	"github.com/UnlockedLabs/unlocked-core/backend/src/tasks"

	"github.com/joho/godotenv"
	"github.com/pressly/goose/v3"
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

	go func() {
		sig := <-shutdown
		log.Infof("Received signal: %v. Initiating shutdown...", sig)
		cancel()
	}()

	// `backend scheduler` runs the background jobs; anything else (including
	// the "./backend" argument the charts pass) runs the API server.
	if len(os.Args) > 1 && os.Args[1] == "scheduler" {
		runScheduler(ctx, env == "dev")
		return
	}
	srv := server.NewServer(testing, ctx)
	srv.ListenAndServe(ctx)
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
	mods := registry.All()
	if err := waitForMigrations(ctx, db, mods); err != nil {
		log.Infof("Scheduler stopped before migrations finished: %v", err)
		return
	}
	s := tasks.Start(dev, nc, db.DB, mods)
	log.Info("Scheduler started")
	<-ctx.Done()
	if err := s.Stop(); err != nil {
		log.Errorf("Error stopping scheduler: %v", err)
	}
	log.Info("Scheduler stopped")
}

// migrationPollInterval is how often the scheduler checks whether the
// database has caught up with this image's migrations.
const migrationPollInterval = 5 * time.Second

// waitForMigrations blocks until the database has every core and module
// migration this image ships with. Starting earlier would query tables or
// columns that don't exist yet, and the scheduler builds its job list only
// once, at start.
func waitForMigrations(ctx context.Context, db *database.DB, mods []module.Module) error {
	sqlDB, err := db.DB.DB()
	if err != nil {
		return fmt.Errorf("get database connection: %w", err)
	}
	for {
		pending, err := database.CoreMigrationsPending(ctx, sqlDB)
		if err == nil && !pending {
			pending, err = module.Pending(ctx, sqlDB, goose.DialectPostgres, mods)
		}
		switch {
		case err != nil:
			log.Warnf("Waiting for migrations: %v", err)
		case pending:
			log.Info("Waiting for migrations to finish")
		default:
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(migrationPollInterval):
		}
	}
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
