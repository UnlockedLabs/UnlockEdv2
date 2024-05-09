package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"sync"

	"github.com/joho/godotenv"

	_ "github.com/glebarez/sqlite"
)

type ProviderServiceInterface interface {
	GetID() int
	GetUsers() ([]UnlockEdImportUser, error)
	GetPrograms() ([]UnlockEdImportProgram, error)
	// TODO: GetMilestones()
	// TODO: GetActivity()
	// TODO: GetOutcomes()
}

/**
* Handler struct that will be passed to our HTTP server handlers
* to handle the different routes.
* It will have a refernce to the KolibriService struct
**/
type ServiceHandler struct {
	services []ProviderServiceInterface
	Mux      *http.ServeMux
	token    string
	db       *sql.DB
	mutex    sync.Mutex
}

func NewServiceHandler(token string, db *sql.DB) *ServiceHandler {
	return &ServiceHandler{
		token:    token,
		db:       db,
		services: make([]ProviderServiceInterface, 0),
		Mux:      http.NewServeMux(),
	}
}

func main() {
	if err := godotenv.Load("../.env"); err != nil {
		log.Println("Failed to load .env file, using default env variables")
	}
	db, err := sql.Open("sqlite", "providers.db")
	if err != nil {
		create, err := os.Create("providers.db")
		if err != nil {
			log.Fatalf("Failed to create database file: %v", err)
		}
		create.Close()
		db, err = sql.Open("sqlite", "providers.db")
		if err != nil {
			log.Fatalf("Failed to open database after creation: %v", err)
		}
	}
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS providers (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,
    account_id TEXT NOT NULL,
    url TEXT NOT NULL,
    api_key TEXT,
    username TEXT,
    password TEXT
);`)
	if err != nil {
		log.Fatalf("Failed to create table: %v", err)
	}
	defer db.Close()
	var file *os.File
	file, err = os.OpenFile("logs/middleware.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Fatalf("Failed to open log file: %v", err)
	}
	log.SetOutput(file)
	token := os.Getenv("PROVIDER_SERVICE_KEY")
	log.Println("Token: ", token)
	handler := NewServiceHandler(token, db)
	log.Println("Server started on :8081")
	handler.RegisterRoutes()
	log.Println("Routes registered")
	err = http.ListenAndServe(":8081", handler.Mux)
	if err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
