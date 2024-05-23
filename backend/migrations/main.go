package main

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	if err := godotenv.Load("./backend/.env"); err != nil {
		log.Fatalf("Failed to load .env file: %v", err)
	}
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=prefer",
		os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"), os.Getenv("DB_NAME"))
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN: dsn,
	}), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL database: %v", err)
	}
	log.Println("Connected to the PostgreSQL database")
	MigrateFresh(db)
	os.Exit(0)
}

func MigrateFresh(db *gorm.DB) {
	log.Println("Dropping all tables...")
	for _, table := range database.TableList {
		if err := db.Migrator().DropTable(table); err != nil {
			log.Printf("Failed to drop table: %v", err)
		}
	}
	storedProc, err := os.ReadFile("./backend/src/activities_proc.sql")
	if err != nil {
		log.Fatalf("Failed to read stored procedure file: %v", err)
	}
	if err := db.Exec(string(storedProc)).Error; err != nil {
		log.Fatalf("Failed to create stored procedure: %v", err)
	}
	log.Println("Stored procedure created successfully.")
	MigrateProviderMiddlewareFresh()
	database.Migrate(db)
	database.SeedDefaultData(db)
	for _, job := range models.AllStoredJobs {
		if err := db.Create(&job).Error; err != nil {
			log.Fatalf("Failed to seed job: %v", err)
		}
		log.Println("Seeded job: ", job)
	}
	log.Println("Database successfully migrated from fresh state.")
}

func Migrate(db *gorm.DB) {
	for _, table := range database.TableList {
		log.Printf("Migrating %T table...", table)
		if err := db.AutoMigrate(table); err != nil {
			log.Fatal("Failed to migrate table: ", err)
		}
	}
}

const defaultLeftMenuLinks = `[{"name":"Unlocked Labs","rank":1,"links":[{"Unlocked Labs Website":"http:\/\/www.unlockedlabs.org\/"},{"Unlocked Labs LinkedIn":"https:\/\/www.linkedin.com\/company\/labs-unlocked\/"}],"created_at":null,"updated_at":null}]`

func MigrateProviderMiddlewareFresh() {
	if err := os.Remove("provider-middleware/providers.db"); err != nil {
		log.Printf("Failed to remove sqlite cache database: %v", err)
	}
	if _, err := os.Create("provider-middleware/providers.db"); err != nil {
		log.Printf("Failed to create sqlite cache database: %v", err)
	}
}
