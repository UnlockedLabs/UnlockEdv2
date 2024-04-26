package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"sync"

	"github.com/joho/godotenv"

	_ "github.com/mattn/go-sqlite3"
)

type ProviderServiceInterface interface {
	GetUsers() ([]UnlockEdImportUser, error)
	// TODO: GetContent()
	// TODO: GetMilestones()
	// TODO: GetOutcomes()
}

/**
* Handler struct that will be passed to our HTTP server handlers
* to handle the different routes.
* It will have a refernce to the ProviderService struct
**/
type ServiceHandler struct {
	services []*ProviderService
	token    string
	db       *sql.DB
	mutex    sync.Mutex
}

func NewServiceHandler(token string, db *sql.DB) *ServiceHandler {
	return &ServiceHandler{
		token:    token,
		db:       db,
		services: make([]*ProviderService, 0),
	}
}

func main() {
	if err := godotenv.Load("../.env"); err != nil {
		log.Fatalf("Failed to load .env file: %v", err)
	}
	db, err := sql.Open("sqlite3", "providers.db")
	if err != nil {
		create, err := os.Create("providers.db")
		if err != nil {
			log.Fatalf("Failed to create database file: %v", err)
		}
		create.Close()
		db, err = sql.Open("sqlite3", "providers.db")
		if err != nil {
			log.Fatalf("Failed to open database after creation: %v", err)
		}
	}
	defer db.Close()
	token := os.Getenv("KOLIBRI_MIDDLEWARE_AUTH_TOKEN")
	handler := NewServiceHandler(token, db)
	err = http.ListenAndServe(":8081", handler)
	if err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
	log.Println("Server started on :8081")
}
