package database

import (
	"Go-Prototype/backend/cmd/models"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
	"sync"

	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var (
	database *DB
	once     sync.Once
)

type DB struct {
	Conn *gorm.DB
}

var TableList = []interface{}{
	&models.User{},
	&models.ProviderPlatform{},
	&models.UserActivity{},
	&models.ProviderUserMapping{},
	&models.LeftMenuLink{},
	&models.Program{},
	&models.Milestone{},
}

func InitDB(isTesting bool) *DB {
	var db *gorm.DB
	var err error

	if isTesting {
		db, err = gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
		if err != nil {
			log.Fatal("Failed to connect to SQLite database:", err)
		}
		log.Println("Connected to the SQLite database in memory")
	} else {
		dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
			os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"), os.Getenv("DB_NAME"))
		db, err = gorm.Open(postgres.New(postgres.Config{
			DSN: dsn,
		}), &gorm.Config{})
		if err != nil {
			log.Fatalf("Failed to connect to PostgreSQL database: %v", err)
		}
		log.Println("Connected to the PostgreSQL database")
	}
	once.Do(func() {
		database = &DB{Conn: db}
	})
	if isTesting {
		database.MigrateFresh(isTesting)
		database.SeedTestData()
	}
	database.Migrate()
	return database
}

/**
* Register Migrations here
**/
func (db *DB) Migrate() {
	for _, table := range TableList {
		log.Printf("Migrating %T table...", table)
		if err := db.Conn.AutoMigrate(table); err != nil {
			log.Fatal("Failed to migrate table: ", err)
		}
	}
}

func (db *DB) MigrateFresh(isTesting bool) {
	log.Println("Dropping all tables...")
	for _, table := range TableList {
		if err := db.Conn.Migrator().DropTable(table); err != nil {
			log.Fatalf("Failed to drop table: %v", err)
		}
	}
	// Delete the sqlite cache database in the middleware service file, to normalize ID's
	if !isTesting {
		db.MigrateProviderMiddlewareFresh()
	}
	db.Migrate()
	db.SeedDefaultData()
	log.Println("Database successfully migrated from fresh state.")
}

func (db *DB) SeedDefaultData() {
	user := models.User{
		Username:      "SuperAdmin",
		NameFirst:     "Super",
		NameLast:      "Admin",
		Email:         "admin@unlocked.v2",
		PasswordReset: true,
		Role:          "admin",
		Password:      "ChangeMe!",
	}
	log.Printf("Creating user: %v", user)
	err := user.HashPassword()
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}
	if err := db.Conn.Create(&user).Error; err != nil {
		log.Fatalf("Failed to create user: %v", err)
	}
	links := []models.LeftMenuLink{}
	if err := json.Unmarshal([]byte(defaultLeftMenuLinks), &links); err != nil {
		log.Fatalf("Failed to unmarshal default left menu links: %v", err)
	}
	if err := db.Conn.Create(&links).Error; err != nil {
		log.Fatalf("Failed to create left menu links: %v", err)
	}
}

const defaultLeftMenuLinks = `[{"id":1,"name":"Unlocked Labs","rank":1,"links":[{"Unlocked Labs Website":"http:\/\/www.unlockedlabs.org\/"},{"Unlocked Labs LinkedIn":"https:\/\/www.linkedin.com\/company\/labs-unlocked\/"}],"created_at":null,"updated_at":null}]`

func (db *DB) SeedTestData() {
	platforms, err := os.ReadFile("test_data/provider_platforms.json")
	if err != nil {
		log.Fatalf("Failed to read test data: %v", err)
	}
	var platform []models.ProviderPlatform
	if err := json.Unmarshal(platforms, &platform); err != nil {
		log.Fatalf("Failed to unmarshal test data: %v", err)
	}
	for _, p := range platform {
		if err := db.Conn.Create(&p).Error; err != nil {
			log.Fatalf("Failed to create platform: %v", err)
		}
	}
	users, err := os.ReadFile("test_data/users.json")
	if err != nil {
		log.Fatalf("Failed to read test data: %v", err)
	}
	var user []models.User
	if err := json.Unmarshal(users, &user); err != nil {
		log.Fatalf("Failed to unmarshal test data: %v", err)
	}
	for idx, u := range user {
		if err := db.Conn.Create(&u).Error; err != nil {
			log.Fatalf("Failed to create user: %v", err)
		}
		for i := 0; i < len(platform); i++ {
			mapping := models.ProviderUserMapping{
				UserID:             u.ID,
				ProviderPlatformID: platform[i].ID,
				ExternalUsername:   u.Username,
				ExternalUserID:     strconv.Itoa(idx),
			}
			if err = db.CreateProviderUserMapping(&mapping); err != nil {
				return
			}
		}
	}
}

func (db *DB) MigrateProviderMiddlewareFresh() {
	if err := os.Remove("backend/provider-middleware/providers.db"); err != nil {
		log.Printf("Failed to remove sqlite cache database: %v", err)
	}
	if _, err := os.Create("backend/provider-middleware/providers.db"); err != nil {
		log.Printf("Failed to create sqlite cache database: %v", err)
	}
}
