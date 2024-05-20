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
	GetMilestonesForProgramUser(courseId, userId string) ([]UnlockEdImportMilestone, error)
	GetActivityForProgram(courseId string) ([]UnlockEdImportActivity, error)
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

func newServiceHandler(token string, db *sql.DB) *ServiceHandler {
	return &ServiceHandler{
		token:    token,
		db:       db,
		services: make([]ProviderServiceInterface, 0),
		Mux:      http.NewServeMux(),
	}
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Failed to load .env file, using default env variables")
	}
	db, err := sql.Open("sqlite", "provider-middleware/providers.db")
	if err != nil {
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
	file := os.Stdout
	if os.Getenv("APP_ENV") == "prod" {
		file, err = os.OpenFile("logs/provider-middleware.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			file, err = os.Create("logs/provider-middleware.log")
			if err != nil {
				log.Fatalf("Failed to create log file: %v", err)
			}
		}
	}
	log.SetOutput(file)
	token := os.Getenv("PROVIDER_SERVICE_KEY")
	log.Println("Token: ", token)
	handler := newServiceHandler(token, db)
	log.Println("Server started on :8081")
	handler.registerRoutes()
	log.Println("Routes registered")
	err = http.ListenAndServe(":8081", handler.Mux)
	if err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
