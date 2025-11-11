package database

import (
	"UnlockEdv2/src/config"
	"UnlockEdv2/src/models"
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"
	"unicode"

	"github.com/glebarez/sqlite"
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
		if !unicode.IsDigit(char) && !unicode.IsLetter(char) && !unicode.IsSpace(char) && char != '-' {
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

func InitDB(cfg *config.Config, isTesting bool) *DB {
	var gormDb *gorm.DB
	var err error
	if isTesting {
		gormDb, err = gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{
			DisableForeignKeyConstraintWhenMigrating: true,
		})
		if err != nil {
			logrus.Fatal("Failed to connect to SQLite database:", err)
		}
		logrus.Println("Connected to the SQLite database in memory")
		MigrateTesting(gormDb)
	} else {
		// Use DSN if provided, otherwise build from parts
		dsn := cfg.AppDSN

		if dsn == "" {
			dsn = fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=allow",
				cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName)
		}

		db, err := sql.Open("pgx", dsn)
		if err != nil {
			logrus.Fatalf("Failed to open database connection: %v", err)
		}
		if err := db.Ping(); err != nil {
			logrus.Fatalf("Failed to ping database: %v", err)
		}
		logrus.Println("Running up migrations...")

		if err := goose.Up(db, cfg.MigrationDir); err != nil {
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
	var kiwixURL string
	if cfg != nil {
		kiwixURL = cfg.KiwixServerURL
	}
	DB.SeedDefaultData(isTesting, kiwixURL)

	return DB
}

func MigrateTesting(db *gorm.DB) {
	var TableList = []any{
		&models.Role{},
		&models.User{},
		&models.Facility{},
		&models.ProviderPlatform{},
		&models.ProviderUserMapping{},
		&models.HelpfulLink{},
		&models.Course{},
		&models.Program{},
		&models.ProgramCreditType{},
		&models.ProgramType{},
		&models.ProgramClass{},
		&models.FacilitiesPrograms{},
		&models.ProgramClassEvent{},
		&models.ProgramClassEnrollment{},
		&models.ProgramCompletion{},
		&models.ProgramClassEventOverride{},
		&models.ProgramClassEventAttendance{},
		&models.Milestone{},
		&models.Outcome{},
		&models.Activity{},
		&models.OidcClient{},
		&models.ChangeLogEntry{},
		&models.OpenContentProvider{},
		&models.OpenContentUrl{},
		&models.OpenContentActivity{},
		&models.CronJob{},
		&models.RunnableTask{},
		&models.Library{},
		&models.FacilityVisibilityStatus{},
		&models.Video{},
		&models.VideoDownloadAttempt{},
		&models.OpenContentFavorite{},
		&models.UserEnrollment{},
		&models.UserCourseActivityTotals{},
		&models.ProgramClassesHistory{},
		&models.UserAccountHistory{},
	}
	logrus.Println("Running up migrations...")
	for _, table := range TableList {
		logrus.Printf("Migrating %T table...", table)
		if err := db.AutoMigrate(table); err != nil {
			logrus.Fatal("Failed to migrate table: ", err)
		}
	}

}

func (db *DB) SeedDefaultData(isTesting bool, kiwixURL string) {
	var count int64
	if err := db.Model(models.User{}).Where("id = ?", 1).Count(&count).Error; err != nil {
		logrus.Fatal("db transaction failed getting admin user")
	}
	if count == 0 {
		if err := db.Model(models.Facility{}).Where("id = ?", 1).Count(&count).Error; err != nil {
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
		defaultProviders := []models.OpenContentProvider{
			{Title: models.Youtube, Url: models.YoutubeApi, CurrentlyEnabled: true, ThumbnailUrl: models.YoutubeThumbnail, Description: models.YoutubeDescription},
		}
		// Only add Kiwix provider if URL is configured
		if kiwixURL != "" {
			defaultProviders = append([]models.OpenContentProvider{
				{Title: models.Kiwix, Url: kiwixURL, CurrentlyEnabled: true, ThumbnailUrl: models.KiwixThumbnailURL, Description: models.Kiwix},
			}, defaultProviders...)
		}
		for idx := range defaultProviders {
			if err := db.Create(&defaultProviders[idx]).Error; err != nil {
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
