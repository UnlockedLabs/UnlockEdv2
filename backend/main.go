package main

import (
	"backend/database"
	server "backend/handlers"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Fatalf("Error loading .env file: %v", err)
	}
	logfile := os.Stdout

	if os.Getenv("APP_ENV") == "prod" {
		logfile, err := os.OpenFile("logs/server.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			file, err := os.Create("logs/server.log")
			if err != nil {
				log.Fatalf("Error creating log file: %v", err)
			}
			logfile = file
		}
		defer logfile.Close()
	}
	logger := log.New(logfile, "INFO: ", log.Ldate|log.Ltime|log.Lshortfile)

	env := os.Getenv("APP_ENV")
	testing := (env == "testing")
	db := database.InitDB(testing)

	cmd := ParseArgs()
	if cmd.RunMigrations {
		db.Migrate()
	} else if cmd.MigrateFresh {
		db.MigrateFresh()
	}

	mux := http.NewServeMux()
	newServer := server.NewServer(db, logger, mux)
	newServer.RegisterRoutes()

	newServer.Logger.Println("Starting server on :8080")
	if err := http.ListenAndServe(":8080", mux); err != nil {
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
