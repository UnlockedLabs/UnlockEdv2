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

const (
	DaysInPast     = 90
	MonthsInFuture = 6
)

var (
	startDate = time.Now().AddDate(0, 0, -DaysInPast)
	endDate   = time.Now().AddDate(0, MonthsInFuture, 0)
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
	platforms := []models.ProviderPlatform{
		{
			Name:      "Canvas",
			BaseUrl:   "https://canvas.staging.unlockedlabs.xyz",
			AccountID: "1",
			Type:      models.CanvasOSS,
			State:     models.Enabled,
			AccessKey: "testing_key_replace_me",
		}, {
			Name:      "kolibri_testing",
			BaseUrl:   "https://kolibri.staging.unlockedlabs.xyz",
			AccountID: "1234567890",
			Type:      models.Kolibri,
			State:     models.Enabled,
			AccessKey: "testing_key_replace_me",
		}}
	for idx := range platforms {
		if err := db.Create(&platforms[idx]).Error; err != nil {
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
		for i := 0; i < len(platforms); i++ {
			mapping := models.ProviderUserMapping{
				UserID:             users[idx].ID,
				ProviderPlatformID: platforms[i].ID,
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
					ExternalID:  strconv.Itoa(rand.Intn(9999)),
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
		startDate := time.Now().AddDate(0, 0, -90)
		endDate := time.Now()
		for _, event := range events {
			rule, err := rrule.StrToRRule(event.RecurrenceRule)
			if err != nil {
				log.Printf("Failed to parse rrule for event %d: %v", event.ID, err)
				continue
			}

			occurrences := rule.Between(startDate, endDate, true)

			for _, occ := range occurrences {
				attendanceDate := occ.Format("2006-01-02")
				attendance := models.ProgramSectionEventAttendance{
					EventID: event.ID,
					UserID:  user.ID,
					Date:    attendanceDate,
				}

				result := db.Where(attendance).FirstOrCreate(&attendance)
				if result.Error != nil {
					log.Printf("Failed to create attendance for user %d on %s: %v", user.ID, attendance.Date, result.Error)
				} else if result.RowsAffected == 0 {
					log.Printf("Attendance already exists for user %d on %s for event %d. Skipping.", user.ID, attendanceDate, event.ID)
				} else {
					log.Printf("Created attendance for user %s at event: %d on %s", user.Username, event.SectionID, attendanceDate)
				}
			}
		}
	}
}

func createFacilityPrograms(db *gorm.DB) ([]models.ProgramSection, error) {
	facilities := []models.Facility{}
	randNames := []string{"Anger Management", "Substance Abuse Treatment", "AA/NA", "Thinking for a Change", "A New Freedom", "Dog Training", "A New Path", "GED/Hi-SET", "Parenting", "Employment", "Life Skills", "Health and Wellness", "Financial Literacy", "Computer Skills", "Parenting", "Employment", "Life Skills"}
	if err := db.Find(&facilities).Error; err != nil {
		return nil, err
	}
	toReturn := make([]models.ProgramSection, 0)
	for idx := range facilities {
		prog := []models.Program{
			{
				Name:        randNames[rand.Intn(len(randNames))],
				Description: "Testing program",
			},
			{
				Name:        randNames[rand.Intn(len(randNames))],
				Description: "Testing program",
			},
			{
				Name:        randNames[rand.Intn(len(randNames))],
				Description: "Testing program",
			},
			{
				Name:        randNames[rand.Intn(len(randNames))],
				Description: "Testing program",
			},
		}
		for i := range prog {
			if err := db.Create(&prog[i]).Error; err != nil {
				log.Fatalf("Failed to create program: %v", err)
			}
			section := models.ProgramSection{
				FacilityID: facilities[idx].ID,
				ProgramID:  prog[i].ID,
			}
			if err := db.Create(&section).Error; err != nil {
				log.Fatalf("Failed to create program section: %v", err)
			}
			log.Println("Creating program section ", section.ID)
			toReturn = append(toReturn, section)

			randDays := []rrule.Weekday{}
			days := []rrule.Weekday{rrule.MO, rrule.TU, rrule.WE, rrule.TH, rrule.FR, rrule.SA, rrule.SU}
			for i := 0; i < rand.Intn(3); i++ {
				randDays = append(randDays, days[rand.Intn(len(days))])
			}
			rule, err := rrule.NewRRule(rrule.ROption{
				Freq:      rrule.WEEKLY,
				Dtstart:   startDate,
				Until:     endDate,
				Byweekday: randDays,
			})
			if err != nil {
				log.Fatalf("Failed to create rrule: %v", err)
			}
			event := models.ProgramSectionEvent{
				SectionID:      section.ID,
				RecurrenceRule: rule.String(),
				Location:       "Classroom #" + strconv.Itoa(rand.Intn(10)),
				Duration:       "1h0m0s",
			}
			if err := db.Create(&event).Error; err != nil {
				log.Fatalf("Failed to create event: %v", err)
			}
		}
	}
	return toReturn, nil
}
