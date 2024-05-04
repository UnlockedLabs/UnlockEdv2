package main

import (
	server "Go-Prototype/backend/cmd/handlers"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Print("no .env file found, using default env variables")
	}
	env := os.Getenv("APP_ENV")
	testing := (env == "testing")
	cmd := ParseArgs()
	newServer := server.NewServer(testing)
	if cmd.RunMigrations {
		newServer.Db.Migrate()
	} else if cmd.MigrateFresh || os.Getenv("MIGRATE_FRESH") == "true" {
		log.Println("Migrating fresh")
		newServer.Db.MigrateFresh(testing)
	}
	newServer.LogInfo("Starting server on :8080")
	if err := http.ListenAndServe(":8080", server.CorsMiddleware(newServer.Mux)); err != nil {
		log.Fatalf("Error starting server: %v", err)
	}
}

type Command struct {
	RunMigrations bool
	MigrateFresh  bool
}

func ParseArgs() *Command {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "--migrate":
			return &Command{RunMigrations: true}
		case "--migrate-fresh":
			return &Command{MigrateFresh: true}
		}
	}
	return &Command{}
}
