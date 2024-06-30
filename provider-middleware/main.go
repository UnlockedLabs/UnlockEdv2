package main

import (
	"UnlockEdv2/src/models"
	"fmt"
	"net/http"
	"os"

	_ "github.com/jackc/pgx"
	"github.com/joho/godotenv"
	log "github.com/sirupsen/logrus"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type ProviderServiceInterface interface {
	GetUsers(db *gorm.DB) ([]models.ImportUser, error)
	ImportPrograms(db *gorm.DB) error
	ImportMilestonesForProgramUser(courseId, userId uint, db *gorm.DB) error
	ImportActivityForProgram(courseId string, db *gorm.DB) error
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
	db       *gorm.DB
}

func newServiceHandler(token string, db *gorm.DB) *ServiceHandler {
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
	dsn := os.Getenv("APP_DSN")
	if dsn == "" {
		dsn = fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=allow",
			os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"), os.Getenv("DB_NAME"))
	}
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN: dsn,
	}), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL database: %v", err)
	}
	log.Println("Connected to the PostgreSQL database")
	token := os.Getenv("PROVIDER_SERVICE_KEY")
	initLogging()
	log.Debugf("loggin initiated with level %v", log.GetLevel())
	handler := newServiceHandler(token, db)
	log.Println("Server started on :8081")
	handler.registerRoutes()
	log.Println("Routes registered")
	err = http.ListenAndServe(":8081", handler.Mux)
	if err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func initLogging() {
	var file *os.File
	var err error
	env := os.Getenv("APP_ENV")
	if env == "production" || env == "prod" {
		file, err = os.OpenFile("logs/provider-middleware.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			file, err = os.Create("logs/provider-middleware.log")
			if err != nil {
				log.Fatalf("Failed to create log file: %v", err)
			}
		}
	} else {
		file = os.Stdout
	}
	log.SetOutput(file)
	log.SetFormatter(&log.JSONFormatter{})
	if os.Getenv("LOG_LEVEL") == "" {
		switch env {
		case "prod":
		case "production":
			log.SetLevel(log.InfoLevel)
		default:
			log.SetLevel(log.DebugLevel)
		}
	} else {
		level, err := log.ParseLevel(os.Getenv("LOG_LEVEL"))
		if err != nil {
			log.SetLevel(log.DebugLevel)
		}
		log.SetLevel(level)
	}
}
