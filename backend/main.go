package main

import (
	server "Go-Prototype/src/handlers"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	if err := godotenv.Load(); err != nil {
		slog.Info("no .env file found, using default env variables")
	}
	var file *os.File
	var err error
	port := os.Getenv("APP_PORT")
	if port == "" {
		port = "8080"
	}
	env := os.Getenv("APP_ENV")
	testing := (env == "testing")
	prod := (env == "prod" || env == "production")
	if prod {
		file, err = os.OpenFile("logs/server.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			log.Fatalf("Failed to open log file: %v", err)
		}
	} else {
		file = os.Stdout
	}
	defer file.Close()
	slog.SetDefault(slog.New(slog.NewJSONHandler(file, nil)))
	newServer := server.NewServer(testing)
	newServer.Db.Migrate()
	newServer.LogInfo("Starting server on :", port)
	fmt.Println("Starting server on :", port)
	if err := http.ListenAndServe(":8080", server.CorsMiddleware(newServer.Mux)); err != nil {
		log.Fatalf("Error starting server: %v", err)
	}
}