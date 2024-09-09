package main

import (
	"UnlockEdv2/src/database"
	"context"
	"database/sql"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"

	_ "github.com/jackc/pgx"
	"github.com/joho/godotenv"
	"github.com/nats-io/nats.go"
	client "github.com/ory/kratos-client-go"
	"github.com/pressly/goose/v3"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	var migrationDir string
	fresh := flag.Bool("fresh", false, "Drop all tables and reapply migrations")
	flag.StringVar(&migrationDir, "dir", "backend/migrations", "The directory containing the migration files")
	flag.Parse()
	if err := godotenv.Load(); err != nil {
		log.Fatalf("Failed to load .env file: %v", err)
	}
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=prefer",
		os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"), os.Getenv("DB_NAME"))
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		log.Fatalf("Failed to open database connection: %v", err)
	}
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Connected to the PostgreSQL database")
	if *fresh {
		log.Println("Running fresh migrations...")
		if err := goose.Reset(db, migrationDir, goose.WithAllowMissing()); err != nil {
			log.Fatalf("Failed to run down migrations: %v", err)
		}
	}
	log.Println("Running up migrations...")
	if err := goose.Up(db, migrationDir); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}
	if *fresh {
		MigrateFresh(db)
	}
	log.Println("Migrations completed successfully")
	os.Exit(0)
}

func MigrateFresh(db *sql.DB) {
	options := nats.GetDefaultOptions()
	url := os.Getenv("NATS_URL")
	if url == "" {
		url = "nats://localhost:4222"
	}
	options.Url = url
	conn, err := options.Connect()
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()
	if err := syncOryKratos(); err != nil {
		log.Fatal("unable to delete identities from kratos instance")
	}
	gormDb, err := gorm.Open(postgres.New(postgres.Config{Conn: db}), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to open gorm connection: %v", err)
	}

	flushNats(conn)
	database.SeedDefaultData(gormDb, false)
	log.Println("Database successfully migrated from fresh state.")
	log.Println("\033[31mIf the server is running, you MUST restart it\033[0m")
}

func syncOryKratos() error {
	config := client.Configuration{
		Servers: client.ServerConfigurations{
			{
				URL: os.Getenv("KRATOS_ADMIN_URL"),
			},
			{
				URL: os.Getenv("KRATOS_PUBLIC_URL"),
			},
		},
	}
	ory := client.NewAPIClient(&config)
	identities, resp, err := ory.IdentityAPI.ListIdentities(context.Background()).Execute()
	if err != nil {
		log.Fatal("Error getting identities from kratos integration")
		return err
	}
	if resp.StatusCode != 200 {
		log.Fatalf("kratos identites response failed with code %d", resp.StatusCode)
		return errors.New("kratos client failed to send request")
	}
	for _, user := range identities {
		id := user.GetId()
		resp, err := ory.IdentityAPI.DeleteIdentity(context.Background(), id).Execute()
		if err != nil {
			log.Fatal("unable to delete identity from Ory Kratos")
			continue
		}
		if resp.StatusCode != 204 {
			log.Fatal("unable to delete identity from Ory Kratos")
			continue
		} else {
			log.Println("identity deleted successfully")
			continue
		}
	}
	log.Println("ory identities deleted successfully")
	return nil
}

func flushNats(conn *nats.Conn) {
	js, err := conn.JetStream()
	if err != nil {
		log.Fatal("error initializing JetStream cache")
	}
	streamCh := js.Streams()

	var streamList []*nats.StreamInfo
	for streamInfo := range streamCh {
		streamList = append(streamList, streamInfo)
	}

	for _, streamInfo := range streamList {
		if err := js.DeleteStream(streamInfo.Config.Name); err != nil {
			log.Println("error deleting stream", err)
		}
	}
}
