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
	GetContent() ([]UnlockEdImportContent, error)
	// TODO: GetMilestones()
	// TODO: GetOutcomes()
}

/**
* Handler struct that will be passed to our HTTP server handlers
* to handle the different routes.
* It will have a refernce to the KolibriService struct
**/
type ServiceHandler struct {
	services []ProviderServiceInterface
	token    string
	db       *sql.DB
	mutex    sync.Mutex
}

func NewServiceHandler(token string, db *sql.DB) *ServiceHandler {
	return &ServiceHandler{
		token:    token,
		db:       db,
		services: make([]ProviderServiceInterface, 0),
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
	token := os.Getenv("PROVIDER_SERVICE_KEY")
	log.Println("Token: ", token)
	handler := NewServiceHandler(token, db)
	log.Println("Server started on :8081")
	err = http.ListenAndServe(":8081", handler)
	if err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
