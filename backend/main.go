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

	logfile, err := os.OpenFile("logs/server.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		log.Fatalf("Error opening log file: %v", err)
	}
	defer logfile.Close()
	logger := log.New(logfile, "INFO: ", log.Ldate|log.Ltime|log.Lshortfile)
	env := os.Getenv("APP_ENV")
	var testing bool = (env == "testing")

	db := database.InitDB(testing)

	newServer := server.NewServer(db, logger)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/users", newServer.IndexUsers)

	log.Println("Starting server on :8080")
	if err := http.ListenAndServe(":8080", mux); err != nil {
		log.Fatalf("Error starting server: %v", err)
	}
}
