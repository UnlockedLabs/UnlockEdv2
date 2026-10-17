package main

import (
	"context"
	"database/sql"
	"errors"
	"flag"
	"io/fs"
	"log"
	"os"

	"github.com/UnlockedLabs/unlocked-core/backend/src/database"
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/registry"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
	"github.com/pressly/goose/v3"
)

func main() {
	var migrationDir string
	fresh := flag.Bool("fresh", false, "Drop all tables and reapply migrations")
	flag.StringVar(&migrationDir, "dir", "./backend/migrations", "The directory containing the migration files")
	flag.Parse()
	if err := godotenv.Load(); err != nil && !errors.Is(err, fs.ErrNotExist) {
		log.Fatalf("Failed to load .env file: %v", err)
	}
	if *fresh && os.Getenv("APP_ENV") != "dev" {
		log.Fatal("-fresh drops all tables and identities; refusing to run unless APP_ENV=dev")
	}
	db, err := sql.Open("pgx", database.PostgresDSN("prefer"))
	if err != nil {
		log.Fatalf("Failed to open database connection: %v", err)
	}
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Connected to the PostgreSQL database")
	goose.SetVerbose(true)
	err = goose.SetDialect("postgres")
	if err != nil {
		log.Fatal(err)
	}
	goose.SetTableName("public.goose_db_version")
	ctx := context.Background()
	mods := registry.All()
	if *fresh {
		log.Println("Running fresh migrations...")
		// Modules first: their tables can reference core's.
		if err := module.Reset(ctx, db, goose.DialectPostgres, mods); err != nil {
			log.Fatalf("Failed to reset module migrations: %v", err)
		}
		if err := goose.Reset(db, migrationDir, goose.WithAllowMissing()); err != nil {
			log.Fatalf("Failed to run down migrations: %v", err)
		}
	}
	log.Println("Running up migrations...")
	if err := goose.Up(db, migrationDir); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}
	if err := module.Migrate(ctx, db, goose.DialectPostgres, mods); err != nil {
		log.Fatalf("Module migrations failed: %v", err)
	}
	if *fresh {
		MigrateFresh(db)
	}
	log.Println("Migrations completed successfully")
	os.Exit(0)
}
