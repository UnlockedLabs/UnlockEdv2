package main

import (
	"UnlockEdv2/src/database"
	"context"
	"errors"
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	client "github.com/ory/kratos-client-go"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	if err := godotenv.Load(); err != nil {
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
	storedProc := `CREATE OR REPLACE FUNCTION public.insert_daily_activity(
    _user_id INT,
    _program_id INT,
    _type VARCHAR,
    _total_time INT,
    _external_id VARCHAR)
    RETURNS VOID AS $$
    DECLARE
        prev_total_time INT;
    BEGIN
        SELECT total_time INTO prev_total_time FROM activities
        WHERE user_id = _user_id AND program_id = _program_id
        ORDER BY created_at DESC LIMIT 1;

        IF prev_total_time IS NULL THEN
            prev_total_time := 0;
        END IF;
    INSERT INTO activities (user_id, program_id, type, total_time, time_delta, external_id, created_at, updated_at)
    VALUES (_user_id, _program_id, _type, _total_time, _total_time - prev_total_time, _external_id, NOW(), NOW());
    END;
    $$ LANGUAGE plpgsql;`
	if err := db.Exec(string(storedProc)).Error; err != nil {
		log.Fatalf("Failed to create stored procedure: %v", err)
	}
	log.Println("Stored procedure created successfully.")
	database.Migrate(db)
	if err := syncOryKratos(); err != nil {
		log.Fatal("unable to delete identities from kratos instance")
	}
	database.SeedDefaultData(db, false)
	log.Println("Database successfully migrated from fresh state.")
}

func syncOryKratos() error {
	config := client.Configuration{
		Servers: client.ServerConfigurations{
			{
				URL: os.Getenv("KRATOS_ADMIN_URL"),
			},
			{
				URL: os.Getenv("KRATOS_PUBLIC_URL"),
			},
		},
	}
	ory := client.NewAPIClient(&config)
	identities, resp, err := ory.IdentityAPI.ListIdentities(context.Background()).Execute()
	if err != nil {
		log.Fatal("Error getting identities from kratos integration")
		return err
	}
	if resp.StatusCode != 200 {
		log.Fatalf("kratos identites response failed with code %d", resp.StatusCode)
		return errors.New("kratos client failed to send request")
	}
	for _, user := range identities {
		id := user.GetId()
		resp, err := ory.IdentityAPI.DeleteIdentity(context.Background(), id).Execute()
		if err != nil {
			log.Fatal("unable to delete identity from Ory Kratos")
			continue
		}
		if resp.StatusCode != 204 {
			log.Fatal("unable to delete identity from Ory Kratos")
			continue
		} else {
			continue
		}
	}
	log.Println("ory identities deleted successfully")
	return nil
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
