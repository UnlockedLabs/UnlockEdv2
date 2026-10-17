//go:build dev

// MigrateFresh and its helpers reset the database, delete every Kratos
// identity, and flush every NATS stream. Built only into local-dev binaries
// (`-tags dev`, see the Makefile) so the deploy image -- which the main
// backend's APP_ENV=production process can exec into -- physically cannot
// run this path, no matter what the -fresh runtime guard in main.go checks.

package main

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"os"

	"github.com/UnlockedLabs/unlocked-core/backend/src/database"

	"github.com/nats-io/nats.go"
	client "github.com/ory/kratos-client-go"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func MigrateFresh(db *sql.DB) {
	options := nats.GetDefaultOptions()
	url := os.Getenv("NATS_URL")
	if url == "" {
		url = "nats://localhost:4222"
	}
	options.Url = url
	options.User = os.Getenv("NATS_USER")
	options.Password = os.Getenv("NATS_PASSWORD")
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
	DB := database.NewDB(gormDb)
	DB.SeedDefaultData(false)
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
