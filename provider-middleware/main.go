package main

import (
	"UnlockEdv2/src/config"
	"UnlockEdv2/src/models"
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	_ "github.com/jackc/pgx"
	"github.com/joho/godotenv"
	"github.com/nats-io/nats.go"
	log "github.com/sirupsen/logrus"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type ProviderServiceInterface interface {
	GetUsers(db *gorm.DB) ([]models.ImportUser, error)

	ImportCourses(db *gorm.DB) error

	ImportMilestones(coursePair map[string]any, mappings []map[string]any, db *gorm.DB, lastRun time.Time) error

	ImportActivityForCourse(coursePair map[string]any, db *gorm.DB) error

	GetJobParams() map[string]interface{}
}

/**
* Handler struct that will be passed to our HTTP server handlers
* to handle the different routes.
* It will have a refernce to the KolibriService struct
**/
type ServiceHandler struct {
	nats   *nats.Conn
	Mux    *http.ServeMux
	token  string
	db     *gorm.DB
	cancel context.CancelFunc
	ctx    context.Context
	cfg    *config.Config
}

var logger = sync.OnceValue(func() *log.Logger { return initLogging() })

func newServiceHandler(cfg *config.Config, db *gorm.DB) *ServiceHandler {
	options := nats.GetDefaultOptions()
	options.Url = cfg.NATSURL
	options.User = cfg.NATSUser
	options.Password = cfg.NATSPassword
	if options.Url == "" {
		options.Url = "nats://nats:4222"
	}
	conn, err := options.Connect()
	if err != nil {
		log.Fatalf("Failed to connect to NATS: %v", err)
	}
	log.Println("Connected to NATS at ", options.Url)
	ctx, cancel := context.WithCancel(context.Background())
	return &ServiceHandler{
		token:  cfg.ProviderServiceKey,
		db:     db,
		nats:   conn,
		Mux:    http.NewServeMux(),
		cancel: cancel,
		ctx:    ctx,
		cfg:    cfg,
	}
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Failed to load .env file, using default env variables")
	}
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Configuration error: %v", err)
	}
	models.SetAppKey(cfg.AppKey)
	models.SetKiwixLibraryURL(cfg.KiwixServerURL)

	dsn := buildDSN(cfg)
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN: dsn,
	}), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL database: %v", err)
	}

	handler := newServiceHandler(cfg, db)
	log.Println("Server started on :8081")
	handler.registerRoutes()
	err = handler.initSubscription()
	if err != nil {
		handler.cancel()
		logger().Fatalf("Failed to subscribe to NATS: %v", err)
	}
	err = http.ListenAndServe(":8081", handler.Mux)
	if err != nil {
		handler.cancel()
		logger().Fatalf("Failed to start server: %v", err)
	}
}

func initLogging() *log.Logger {
	var logger = log.New()
	logger.SetFormatter(&log.JSONFormatter{})
	logger.SetLevel(log.InfoLevel)
	return logger
}

func buildDSN(cfg *config.Config) string {
	if cfg.AppDSN != "" {
		return cfg.AppDSN
	}
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=prefer",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName)
}
