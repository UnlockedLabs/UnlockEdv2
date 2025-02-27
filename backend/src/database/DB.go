package database

import (
	"UnlockEdv2/src/models"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"unicode"

	"github.com/glebarez/sqlite"
	_ "github.com/glebarez/sqlite"
	"github.com/go-playground/validator/v10"
	"github.com/pressly/goose/v3"
	"github.com/sirupsen/logrus"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type DB struct{ *gorm.DB }

func NewDB(db *gorm.DB) *DB {
	return &DB{db}
}

func ValidateAlphaNumSpace(fl validator.FieldLevel) bool {
	for _, char := range fl.Field().String() {
		if !unicode.IsDigit(char) && !unicode.IsLetter(char) && !unicode.IsSpace(char) {
			return false
		}
	}
	return true
}

var Validate = sync.OnceValue(func() *validator.Validate {
	Ins := validator.New(validator.WithRequiredStructEnabled())
	err := Ins.RegisterValidation("alphanumspace", ValidateAlphaNumSpace, false)
	if err != nil {
		logrus.Fatalf("Failed to register custom validation: %v", err)
	}
	return Ins
})

func InitDB(isTesting bool) *DB {
	var gormDb *gorm.DB
	var err error
	if isTesting {
		gormDb, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
		if err != nil {
			logrus.Fatal("Failed to connect to SQLite database:", err)
		}
		logrus.Println("Connected to the SQLite database in memory")
		MigrateTesting(gormDb)
	} else {
		dsn := os.Getenv("APP_DSN")
		if dsn == "" {
			dsn = fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=allow",
				os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"), os.Getenv("DB_NAME"))
		}
		db, err := sql.Open("pgx", dsn)
		if err != nil {
			logrus.Fatalf("Failed to open database connection: %v", err)
		}
		if err := db.Ping(); err != nil {
			logrus.Fatalf("Failed to ping database: %v", err)
		}
		logrus.Println("Running up migrations...")
		migrationDir := os.Getenv("MIGRATION_DIR")
		if migrationDir == "" {
			migrationDir = "migrations"
		}
		if err := goose.Up(db, migrationDir); err != nil {
			logrus.Fatalf("Migration failed: %v", err)
		}
		gormDb, err = gorm.Open(postgres.New(postgres.Config{
			Conn: db,
		}), &gorm.Config{
			Logger: logger.New(logrus.New(), logger.Config{LogLevel: logger.Error}),
		})
		if err != nil {
			logrus.Fatalf("Failed to connect to PostgreSQL database using GORM: %v", err)
		}
		logrus.Println("Connected to the PostgreSQL database via GORM")
	}
	DB := &DB{gormDb}
	DB.SeedDefaultData(isTesting)
	if isTesting {
		DB.SeedTestData()
	}
	return DB
}

func MigrateTesting(db *gorm.DB) {
	var TableList = []interface{}{
		&models.Role{},
		&models.User{},
		&models.ProviderPlatform{},
		&models.ProviderUserMapping{},
		&models.HelpfulLink{},
		&models.Course{},
		&models.Program{},
		&models.ProgramTag{},
		&models.ProgramSection{},
		&models.ProgramSectionEvent{},
		&models.ProgramSectionEnrollment{},
		&models.ProgramSectionEventOverride{},
		&models.ProgramSectionEventAttendance{},
		&models.Milestone{},
		&models.Outcome{},
		&models.Activity{},
		&models.OidcClient{},
		&models.ProgramFavorite{},
		&models.Facility{},
		&models.OpenContentProvider{},
		&models.OpenContentUrl{},
		&models.OpenContentActivity{},
		&models.CronJob{},
		&models.RunnableTask{},
		&models.Library{},
		&models.Video{},
		&models.VideoDownloadAttempt{},
		&models.OpenContentFavorite{},
		&models.UserEnrollment{},
		&models.UserCourseActivityTotals{},
	}
	for _, table := range TableList {
		logrus.Printf("Migrating %T table...", table)
		if err := db.AutoMigrate(table); err != nil {
			logrus.Fatal("Failed to migrate table: ", err)
		}
	}
}

func (db *DB) SeedDefaultData(isTesting bool) {
	var count int64
	if err := db.Model(models.User{}).Where("id = ?", fmt.Sprintf("%d", 1)).Count(&count).Error; err != nil {
		logrus.Fatal("db transaction failed getting admin user")
	}
	if count == 0 {
		if err := db.Model(models.Facility{}).Where("id = ?", fmt.Sprintf("%d", 1)).Count(&count).Error; err != nil {
			logrus.Fatal("db transaction failed getting default facility")
		}
		if isTesting {
			roles := []models.Role{{Name: "admin"}, {Name: "student"}, {Name: "system_admin"}}
			for _, role := range roles {
				if err := db.Create(&role).Error; err != nil {
					logrus.Fatalf("Failed to create role: %v", err)
				}
			}
		}
		defaultFacility := models.Facility{
			Name:     "Default",
			Timezone: "America/Chicago",
		}
		logrus.Printf("Creating facility: %v", defaultFacility)
		if err := db.Create(&defaultFacility).Error; err != nil {
			logrus.Fatalf("Failed to create user: %v", err)
		}
		user := models.User{
			Username:   "SuperAdmin",
			NameFirst:  "Super",
			NameLast:   "Admin",
			Email:      "admin@unlocked.v2",
			Role:       models.SystemAdmin,
			FacilityID: 1,
		}
		logrus.Printf("Creating user: %v", user)
		logrus.Println("Make sure to sync the Kratos instance if you are freshly migrating")
		if err := db.Create(&user).Error; err != nil {
			logrus.Fatalf("Failed to create user: %v", err)
		}

		links := []models.HelpfulLink{}
		if err := json.Unmarshal([]byte(defaultLeftMenuLinks), &links); err != nil {
			logrus.Fatalf("Failed to unmarshal default left menu links: %v", err)
		}
		if err := db.Create(&links).Error; err != nil {
			logrus.Fatalf("Failed to create left menu links: %v", err)
		}
		for idx := range defaultOpenContentProviders {
			if err := db.Create(&defaultOpenContentProviders[idx]).Error; err != nil {
				logrus.Fatalf("Failed to create default open content providers: %v", err)
			}
		}
	}
}

const (
	defaultLeftMenuLinks = `[{
			"title": "Unlocked Labs",
			"description": "Unlocked Labs website",
			"url": "https://unlockedlabs.org",
			"visibility_status": true,
	        "thumbnail_url": "https://unlockedlabs.org/favicon.ico",
			"open_content_provider_id": 1,
			"facility_id": 1
		},
	    {
	    "title": "Google",
	    "description": "Google search engine",
	    "url": "https://www.google.com",
	    "visibility_status": true,
	    "open_content_provider_id": 1,
	    "thumbnail_url": "https://www.google.com/favicon.ico",
	    "facility_id": 1
	    }]`
)
