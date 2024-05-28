package main

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Printf("Error loading .env file: %v", err)
	}
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=allow",
		os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"), os.Getenv("DB_NAME"))
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN: dsn,
	}), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL database: %v", err)
	}
	seedTestData(db)
}

func seedTestData(db *gorm.DB) {
	platforms, err := os.ReadFile("backend/tests/test_data/provider_platforms.json")
	if err != nil {
		log.Printf("Failed to read test data: %v", err)
	}
	var platform []models.ProviderPlatform
	if err := json.Unmarshal(platforms, &platform); err != nil {
		log.Printf("Failed to unmarshal test data: %v", err)
	}
	for _, p := range platform {
		if err := db.Create(&p).Error; err != nil {
			log.Printf("Failed to create platform: %v", err)
		}
	}
	userFile, err := os.ReadFile("backend/tests/test_data/users.json")
	if err != nil {
		log.Printf("Failed to read test data: %v", err)
	}
	var users []models.User
	if err := json.Unmarshal(userFile, &users); err != nil {
		log.Printf("Failed to unmarshal test data: %v", err)
	}
	for idx, u := range users {
		log.Printf("Creating user %s", u.Username)
		if err := db.Create(&u).Error; err != nil {
			log.Printf("Failed to create user: %v", err)
		}
		for i := 0; i < len(platform); i++ {
			mapping := models.ProviderUserMapping{
				UserID:             u.ID,
				ProviderPlatformID: platform[i].ID,
				ExternalUsername:   u.Username,
				ExternalUserID:     strconv.Itoa(idx),
			}
			if err = db.Create(&mapping).Error; err != nil {
				log.Printf("Failed to create provider user mapping: %v", err)
			}
		}
	}
	var programs []models.Program
	progs, err := os.ReadFile("backend/tests/test_data/programs.json")
	if err != nil {
		log.Printf("Failed to read test data: %v", err)
	}
	if err := json.Unmarshal(progs, &programs); err != nil {
		log.Printf("Failed to unmarshal test data: %v", err)
	}
	for _, p := range programs {
		if err := db.Create(&p).Error; err != nil {
			log.Printf("Failed to create program: %v", err)
		}
	}
	var milestones []models.Milestone
	mstones, err := os.ReadFile("backend/tests/test_data/milestones.json")
	if err != nil {
		log.Printf("Failed to read test data: %v", err)
	}
	if err := json.Unmarshal(mstones, &milestones); err != nil {
		log.Printf("Failed to unmarshal test data: %v", err)
	}
	outcomes := []string{"completion", "grade", "certificate", "pathway_completion"}
	for _, user := range users {
		for _, prog := range programs {
			startTime := 0
			for i := 0; i < 365; i++ {
				if i%5 == 0 {
					continue
				}
				randTime := rand.Intn(10)
				// we want activity for the last year
				yearAgo := time.Now().AddDate(-1, 0, 0)
				time := yearAgo.AddDate(0, 0, i)
				activity := models.Activity{
					UserID:     user.ID,
					ProgramID:  prog.ID,
					Type:       "interaction",
					TotalTime:  uint(startTime + randTime),
					TimeDelta:  uint(randTime),
					ExternalID: strconv.Itoa(rand.Intn(1000)),
					CreatedAt:  time,
				}
				log.Printf("Creating activity for user %s on %v", user.Username, time)
				startTime += randTime
				if err := db.Create(&activity).Error; err != nil {
					log.Printf("Failed to create activity: %v", err)
				}
			}
			outcome := models.Outcome{
				UserID:    user.ID,
				ProgramID: prog.ID,
				Type:      models.OutcomeType(outcomes[rand.Intn(len(outcomes))]),
			}
			if err := db.Create(&outcome).Error; err != nil {
				log.Printf("Failed to create outcome: %v", err)
			}
		}
		for _, m := range milestones {
			newMilestone := models.Milestone{
				ProgramID:   m.ProgramID,
				IsCompleted: m.IsCompleted,
				Type:        m.Type,
				UserID:      user.ID,
				ExternalID:  strconv.Itoa(rand.Intn(1000)) + m.ExternalID,
			}
			if err := db.Create(&newMilestone).Error; err != nil {
				log.Printf("Failed to create milestone: %v", err)
			}
			log.Printf("Creating milestone for user %s", user.Username)
		}
	}
}
