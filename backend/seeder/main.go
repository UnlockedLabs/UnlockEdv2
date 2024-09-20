package main

import (
	"UnlockEdv2/src/handlers"
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
	"github.com/teambition/rrule-go"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Printf("Error loading .env file: %v", err)
	}
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=prefer",
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
	// isTesting is false because this needs to seed real users w/ kratos
	testServer := handlers.NewServer(false)
	facilityStr, err := os.ReadFile("backend/tests/test_data/facilities.json")
	if err != nil {
		log.Printf("Failed to read test data: %v", err)
	}
	var facilities []models.Facility
	if err := json.Unmarshal(facilityStr, &facilities); err != nil {
		log.Printf("Failed to unmarshal test data: %v", err)
	}
	for idx := range facilities {
		if err := db.Create(&facilities[idx]).Error; err != nil {
			log.Printf("Failed to create facility: %v", err)
		}
	}
	platforms, err := os.ReadFile("backend/tests/test_data/provider_platforms.json")
	if err != nil {
		log.Printf("Failed to read test data: %v", err)
	}
	var platform []models.ProviderPlatform
	if err := json.Unmarshal(platforms, &platform); err != nil {
		log.Printf("Failed to unmarshal test data: %v", err)
	}
	for idx := range platform {
		if err := db.Create(&platform[idx]).Error; err != nil {
			log.Printf("Failed to create platform: %v", err)
		}
	}
	var newPlatforms []models.ProviderPlatform
	if err := db.Find(&newPlatforms).Error; err != nil {
		log.Fatal("Failed to get platforms from db")
	}
	userFile, err := os.ReadFile("backend/tests/test_data/users.json")
	if err != nil {
		log.Printf("Failed to read test data: %v", err)
	}
	var users []models.User
	if err := json.Unmarshal(userFile, &users); err != nil {
		log.Printf("Failed to unmarshal test data: %v", err)
	}
	sections, err := createFacilityPrograms(db)
	if err != nil {
		log.Fatalf("Failed to create facility programs: %v", err)
	}
	for idx := range users {
		log.Printf("Creating user %s", users[idx].Username)
		if err := db.Create(&users[idx]).Error; err != nil {
			log.Printf("Failed to create user: %v", err)
		}
		if err := testServer.HandleCreateUserKratos(users[idx].Username, "ChangeMe!"); err != nil {
			log.Fatalf("unable to create test user in kratos")
		}
		for i := 0; i < len(newPlatforms); i++ {
			mapping := models.ProviderUserMapping{
				UserID:             users[idx].ID,
				ProviderPlatformID: newPlatforms[i].ID,
				ExternalUsername:   users[idx].Username,
				ExternalUserID:     strconv.Itoa(idx),
			}
			if err = db.Create(&mapping).Error; err != nil {
				log.Printf("Failed to create provider user mapping: %v", err)
			}
		}
	}
	var courses []models.Course
	progs, err := os.ReadFile("backend/tests/test_data/courses.json")
	if err != nil {
		log.Printf("Failed to read test data: %v", err)
	}
	if err := json.Unmarshal(progs, &courses); err != nil {
		log.Printf("Failed to unmarshal test data: %v", err)
	}
	for idx := range courses {
		if err := db.Create(&courses[idx]).Error; err != nil {
			log.Fatalf("Failed to create course: %v", err)
		}
	}
	outcomes := []string{"college_credit", "grade", "certificate", "pathway_completion"}
	milestoneTypes := []models.MilestoneType{models.DiscussionPost, models.AssignmentSubmission, models.QuizSubmission, models.GradeReceived}
	var dbUsers []models.User
	if db.Find(&dbUsers).Error != nil {
		log.Fatalf("Failed to get users from db")
		return
	}
	events := []models.ProgramSectionEvent{}
	if err := db.Find(&events).Error; err != nil {
		log.Fatalf("Failed to get events from db")
	}
	for _, user := range dbUsers {
		for _, prog := range courses {
			// all test courses are open_enrollment
			enrollment := models.Milestone{
				CourseID:    prog.ID,
				Type:        models.Enrollment,
				UserID:      user.ID,
				IsCompleted: true,
				ExternalID:  fmt.Sprintf("%d", rand.Intn(1000)),
			}
			enrollment.CreatedAt = prog.CreatedAt
			if err := db.Create(&enrollment).Error; err != nil {
				log.Printf("Failed to create enrollment milestone: %v", err)
				continue
			}
			startTime := 0
			for i := 0; i < 365; i++ {
				if i%5 == 0 {
					continue
				}
				randTime := rand.Intn(1000)
				// we want activity for the last year
				yearAgo := time.Now().AddDate(-1, 0, 0)
				time := yearAgo.AddDate(0, 0, i)
				activity := models.Activity{
					UserID:     user.ID,
					CourseID:   prog.ID,
					Type:       "interaction",
					TotalTime:  uint(startTime + randTime),
					TimeDelta:  uint(randTime),
					ExternalID: strconv.Itoa(rand.Intn(1000)),
					CreatedAt:  time,
				}
				startTime += randTime
				if err := db.Create(&activity).Error; err != nil {
					log.Printf("Failed to create activity: %v", err)
				}
			}
			if rand.Float32() < 0.4 { // 40% chance to create an outcome
				outcome := models.Outcome{
					UserID:   user.ID,
					CourseID: prog.ID,
					Type:     models.OutcomeType(outcomes[rand.Intn(len(outcomes))]),
				}
				if err := db.Create(&outcome).Error; err != nil {
					log.Printf("Failed to create outcome: %v", err)
				}
			} else {
				newMilestone := models.Milestone{
					CourseID:    prog.ID,
					IsCompleted: false,
					Type:        milestoneTypes[rand.Intn(len(milestoneTypes))],
					UserID:      user.ID,
					ExternalID:  strconv.Itoa(rand.Intn(1000)),
				}
				if err := db.Create(&newMilestone).Error; err != nil {
					log.Printf("Failed to create milestone: %v", err)
				}
				log.Printf("Creating milestone for user %s", user.Username)
			}
		}
		for idx := range sections {
			if sections[idx].FacilityID == user.FacilityID {
				enrollment := models.ProgramSectionEnrollment{
					UserID:    user.ID,
					SectionID: sections[idx].ID,
				}
				if err := db.Create(&enrollment).Error; err != nil {
					log.Printf("Failed to create enrollment: %v", err)
				}
				log.Printf("Creating program enrollment for user %s", user.Username)
			}
		}
		for idx := range events {
			attendance := models.ProgramSectionEventAttendance{
				EventID: events[idx].ID,
				UserID:  user.ID,
				Date:    time.Now().String(),
			}
			if err := db.Create(&attendance).Error; err != nil {
				log.Printf("Failed to create attendance for user: %v", err)
			}
		}
	}
}

func createFacilityPrograms(db *gorm.DB) ([]models.ProgramSection, error) {
	facilities := []models.Facility{}
	if err := db.Find(&facilities).Error; err != nil {
		return nil, err
	}
	toReturn := make([]models.ProgramSection, 0)
	for idx := range facilities {
		prog := models.Program{
			Name:        "Program for facility: " + facilities[idx].Name,
			Description: "Testing program",
		}
		if err := db.Create(&prog).Error; err != nil {
			log.Fatalf("Failed to create program: %v", err)
		}
		for i := 0; i < 5; i++ {
			section := models.ProgramSection{
				FacilityID: facilities[idx].ID,
				ProgramID:  prog.ID,
			}
			if err := db.Create(&section).Error; err != nil {
				log.Fatalf("Failed to create program section: %v", err)
			}
			log.Println("Creating program section ", section.ID)
			toReturn = append(toReturn, section)
			daysMap := make(map[int]rrule.Weekday)
			daysMap[0] = rrule.TU
			daysMap[1] = rrule.WE
			daysMap[2] = rrule.TH
			daysMap[3] = rrule.FR
			daysMap[4] = rrule.SA
			daysMap[5] = rrule.SU
			daysMap[6] = rrule.MO
			rule, err := rrule.NewRRule(rrule.ROption{
				Freq:      rrule.WEEKLY,
				Dtstart:   time.Now().Add(time.Duration(time.Month(i))),
				Count:     100,
				Byweekday: []rrule.Weekday{daysMap[rand.Intn(7)]},
			})
			if err != nil {
				log.Fatalf("Failed to create rrule: %v", err)
			}
			event := models.ProgramSectionEvent{
				SectionID:      section.ID,
				RecurrenceRule: rule.String(),
				Location:       "TBD",
				Duration:       "1h0m0s",
			}
			if err := db.Create(&event).Error; err != nil {
				log.Fatalf("Failed to create event: %v", err)
			}
		}
	}
	return toReturn, nil
}
