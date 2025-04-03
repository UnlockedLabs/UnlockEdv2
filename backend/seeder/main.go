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
	"strings"
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
	facilities := []models.Facility{
		{
			Name:     "MVCF",
			Timezone: "America/New_York",
		},
		{
			Name:     "Potosi Correctional Facility",
			Timezone: "America/Chicago",
		},
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
			Name:      "Kolibri",
			BaseUrl:   "https://kolibri.staging.unlockedlabs.xyz",
			AccountID: "1234567890",
			Type:      models.Kolibri,
			State:     models.Enabled,
			AccessKey: "testing_key_replace_me",
		},
		{
			Name:      "Brightspace",
			BaseUrl:   "https://unlocked.brightspacedemo.com",
			AccountID: "testing_client_id_replace_me", //clientID
			Type:      models.Brightspace,
			State:     models.Disabled,
			AccessKey: "testing_client_secret_replace_me", //ClientSecret;refresh-token
		}}
	for idx := range platforms {
		if err := db.Create(&platforms[idx]).Error; err != nil {
			log.Printf("Failed to create platform: %v", err)
		}
	}
	kiwix := models.OpenContentProvider{
		Url:              "http://kiwix:8080",
		Title:            models.Kiwix,
		ThumbnailUrl:     "https://images.fineartamerica.com/images/artworkimages/mediumlarge/3/llamas-wearing-party-hats-in-a-circle-looking-down-john-daniels.jpg",
		CurrentlyEnabled: true,
		Description:      "Kiwix open content provider",
	}
	log.Printf("Creating Open Content Provider %s", kiwix.Url)
	if err := db.Create(&kiwix).Error; err != nil {
		log.Printf("Failed to create open content provider: %v", err)
	}
	kiwixLibraries := []models.Library{
		{
			OpenContentProviderID: kiwix.ID,
			ExternalID:            models.StringPtr("urn:uuid:b218a9b9-1aa5-0c0a-fe3c-eeb4b9bc92e9"),
			Title:                 "C Docs",
			Language:              models.StringPtr("eng"),
			Description:           models.StringPtr("C docs by DevDocs"),
			Url:                   "/content/devdocs_en_c_2025-01",
			ThumbnailUrl:          models.StringPtr("/kiwix.jpg"),
		},
		{
			OpenContentProviderID: kiwix.ID,
			ExternalID:            models.StringPtr("urn:uuid:b231a72f-7d7e-076d-9003-a7e47823e589"),
			Title:                 "Go Docs",
			Language:              models.StringPtr("eng"),
			Description:           models.StringPtr("Go docs by DevDocs"),
			Url:                   "/content/devdocs_en_go_2025-01",
			ThumbnailUrl:          models.StringPtr("/kiwix.jpg"),
		},
	}
	for idx := range kiwixLibraries {
		log.Printf("Creating library %s", kiwixLibraries[idx].Title)
		if err := db.Create(&kiwixLibraries[idx]).Error; err != nil {
			log.Printf("Failed to create library: %v", err)
		}
	}
	var users []models.User
	if err := json.Unmarshal([]byte(usersStr), &users); err != nil {
		log.Printf("Failed to unmarshal test data: %v", err)
	}
	classes, err := createFacilityPrograms(db)
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
		var mapping models.ProviderUserMapping
		for i := 0; i < len(platforms); i++ {
			if platforms[i].Type != models.Brightspace { //omitting brightspace here, we don't want bad users in the seeded data...we want real users
				mapping = models.ProviderUserMapping{
					UserID:             users[idx].ID,
					ProviderPlatformID: platforms[i].ID,
					ExternalUsername:   users[idx].Username,
					ExternalUserID:     strconv.Itoa(idx),
				}
			}
			if err = db.Create(&mapping).Error; err != nil {
				log.Printf("Failed to create provider user mapping: %v", err)
			}
		}
	}
	var courses []models.Course
	if err := json.Unmarshal([]byte(coursesStr), &courses); err != nil {
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
	events := []models.ProgramClassEvent{}
	if err := db.Find(&events).Error; err != nil {
		log.Fatalf("Failed to get events from db")
	}
	enrollmentStatuses := []string{"Enrolled"} //not sure what enrollment statuses will be
	for _, user := range dbUsers {
		for _, prog := range courses {
			// all test courses are open_enrollment
			enrollment := models.UserEnrollment{
				CourseID:   prog.ID,
				UserID:     user.ID,
				ExternalID: fmt.Sprintf("%d", rand.Intn(1000)),
			}
			enrollment.CreatedAt = &prog.CreatedAt
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
					TotalTime:  int64(startTime + randTime),
					TimeDelta:  int64(randTime),
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
		for idx := range classes {
			if classes[idx].FacilityID == user.FacilityID {
				enrollment := models.ProgramClassEnrollment{
					UserID:           user.ID,
					ClassID:        classes[idx].ID,
					EnrollmentStatus: enrollmentStatuses[0], //we can randomize when we know the enrollment statuses
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
				attendance := models.ProgramClassEventAttendance{
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
					log.Printf("Created attendance for user %s at event: %d on %s", user.Username, event.ClassID, attendanceDate)
				}
			}
		}
	}
	createUserSessionActivity(db, dbUsers)
}

func createUserSessionActivity(db *gorm.DB, dbUsers []models.User) {
	now := time.Now()
	threeMonthsInPast := now.AddDate(0, -3, 0)
	for _, user := range dbUsers {
		numSessions := rand.Intn(90)
		for i := 0; i < numSessions; i++ {
			randomDayOffset := rand.Intn(int(now.Sub(threeMonthsInPast).Hours() / 24))
			sessionDate := threeMonthsInPast.Add(time.Duration(randomDayOffset*24) * time.Hour)
			sessionHours := rand.Intn(24)
			sessionMinutes := rand.Intn(60)
			sessionSeconds := rand.Intn(60)
			sessionStart := time.Date(sessionDate.Year(), sessionDate.Month(), sessionDate.Day(), sessionHours, sessionMinutes, sessionSeconds, 0, time.UTC)
			sessionEnd := sessionStart.Add(time.Duration(rand.Intn(720)+15) * time.Minute)
			userSessionTracking := models.UserSessionTracking{
				UserID:         user.ID,
				SessionStartTS: sessionStart,
				SessionEndTS:   sessionEnd,
				SessionID:      sessionStart.Format("2006-01-02 15:04:05"),
			}
			if err := db.Create(&userSessionTracking).Error; err != nil {
				log.Printf("Failed to create userSessionTracking: %v", err)
			}
		}
	}

	openContentUrls := []models.OpenContentUrl{{ContentURL: "/api/proxy/libraries/1/content/devdocs_en_c_2025-01/numeric/math/acos"},
		{ContentURL: "/api/proxy/libraries/1/content/devdocs_en_c_2025-01/numeric/math/acosh"},
		{ContentURL: "/api/proxy/libraries/1/content/devdocs_en_c_2025-01/numeric/math/abs"},
		{ContentURL: "/api/proxy/libraries/1/content/devdocs_en_c_2025-01/numeric/fenv"},
		{ContentURL: "/api/proxy/libraries/1/content/devdocs_en_c_2025-01/index"},
		{ContentURL: "/api/proxy/libraries/1/"},
		{ContentURL: "/api/proxy/libraries/2/content/devdocs_en_go_2025-01/arena/index"},
		{ContentURL: "/api/proxy/libraries/2/content/devdocs_en_go_2025-01/index"},
	}

	for _, url := range openContentUrls {
		if err := db.Create(&url).Error; err != nil {
			log.Printf("Failed to create openconenturl: %v", err)
		}
	}
	if err := db.Find(&openContentUrls).Error; err != nil {
		log.Printf("Failed to get open content urls: %v", err)
	}

	var libraries []models.Library
	if err := db.Model(&models.Library{}).Find(&libraries).Error; err != nil {
		log.Printf("Failed to get open content urls: %v", err)
	}

	for _, user := range dbUsers {
		if user.Role != "student" {
			continue
		}
		for _, kiwix := range libraries {
			numSessions := rand.Intn(90)
			for i := 0; i < numSessions; i++ {
				// Select random facility, provider, and content
				urlID := getRandomURLForLibrary(openContentUrls, int(kiwix.ID))
				randomDayOffset := rand.Intn(int(now.Sub(threeMonthsInPast).Hours() / 24))
				requestDate := threeMonthsInPast.Add(time.Duration(randomDayOffset*24) * time.Hour)
				requestHour := rand.Intn(23)
				requestMinute := rand.Intn(60)
				requestSecond := rand.Intn(60)
				requestTS := time.Date(requestDate.Year(), requestDate.Month(), requestDate.Day(), requestHour, requestMinute, requestSecond, 0, time.UTC)
				stopTS := requestTS.Add(time.Duration(rand.Intn(360)) * time.Minute)
				contentActivity := models.OpenContentActivity{
					RequestTS:             requestTS,
					OpenContentProviderID: kiwix.OpenContentProviderID,
					FacilityID:            user.FacilityID,
					UserID:                user.ID,
					ContentID:             kiwix.ID,
					OpenContentUrlID:      urlID,
					StopTS:                stopTS,
				}
				if err := db.Create(&contentActivity).Error; err != nil {
					log.Printf("Failed to create open content activity: %v", err)
				}
			}

		}
	}
}

func getRandomURLForLibrary(urls []models.OpenContentUrl, libraryID int) uint {
	var filteredUrls []models.OpenContentUrl
	libraryStr := fmt.Sprintf("/libraries/%d/", libraryID)
	for _, url := range urls {
		if strings.Contains(url.ContentURL, libraryStr) {
			filteredUrls = append(filteredUrls, url)
		}
	}
	if len(filteredUrls) == 0 {
		log.Print("unable to find any matching urls, just going to use the first one in the slice")
		return urls[0].ID
	}
	selectedURL := filteredUrls[rand.Intn(len(filteredUrls))]
	return selectedURL.ID
}

func getRandomProgram(programMap map[string]models.PrgType) string {
	keySlice := make([]string, 0, len(programMap))
	for key := range programMap {
		keySlice = append(keySlice, key)
	}
	return keySlice[rand.Intn(len(keySlice))]
}

func createFacilityPrograms(db *gorm.DB) ([]models.ProgramClass, error) {
	facilities := []models.Facility{}
	fundingTypes := []models.FundingType{models.EduGrants, models.FederalGrants, models.InmateWelfare, models.NonProfitOrgs, models.Other, models.StateGrants}
	creditTypes := []models.CreditType{models.Completion, models.EarnedTime, models.Education, models.Participation}
	programMap := map[string]models.PrgType{
		"Anger Management":          models.Therapeutic,
		"Substance Abuse Treatment": models.MntlHlth,
		"AA/NA":                     models.MntlHlth,
		"Thinking for a Change":     models.LifeSkills,
		"A New Freedom":             models.LifeSkills,
		"Dog Training":              models.Vocational,
		"A New Path":                models.Therapeutic,
		"GED/Hi-SET":                models.Educational,
		"Parenting":                 models.LifeSkills,
		"Employment":                models.Vocational,
		"Life Skills":               models.LifeSkills,
		"Health and Wellness":       models.MntlHlth,
		"Financial Literacy":        models.Educational,
		"Computer Skills":           models.Educational,
	}
	programClassDescriptions := map[string]string{
		"Anger Management":          "Techniques to control and express anger constructively.",
		"Substance Abuse Treatment": "Support and strategies for overcoming addiction.",
		"AA/NA":                     "Peer support groups for alcohol and drug recovery.",
		"Thinking for a Change":     "Cognitive-based program for decision-making and behavior change.",
		"A New Freedom":             "Life skills and personal growth program for better choices.",
		"Dog Training":              "Hands-on program teaching dog training and care skills.",
		"A New Path":                "Therapeutic program focused on personal healing and growth.",
		"GED/Hi-SET":                "Education program to earn a high school equivalency diploma.",
		"Parenting":                 "Guidance and skills for effective parenting strategies.",
		"Employment":                "Job readiness, resume building, and interview preparation.",
		"Life Skills":               "Essential skills for daily living and self-sufficiency.",
		"Health and Wellness":       "Education on physical and mental well-being practices.",
		"Financial Literacy":        "Budgeting, saving, and money management fundamentals.",
		"Computer Skills":           "Basic to advanced computer literacy and digital skills.",
	}
	if err := db.Find(&facilities).Error; err != nil {
		return nil, err
	}
	toReturn := make([]models.ProgramClass, 0)
	for idx := range facilities {
		prog := []models.Program{
			{
				Name:        getRandomProgram(programMap),
				FundingType: fundingTypes[rand.Intn(len(fundingTypes))],
			},
			{
				Name:        getRandomProgram(programMap),
				FundingType: fundingTypes[rand.Intn(len(fundingTypes))],
			},
			{
				Name:        getRandomProgram(programMap),
				FundingType: fundingTypes[rand.Intn(len(fundingTypes))],
			},
			{
				Name:        getRandomProgram(programMap),
				FundingType: fundingTypes[rand.Intn(len(fundingTypes))],
			},
			{
				Name:        getRandomProgram(programMap),
				FundingType: fundingTypes[rand.Intn(len(fundingTypes))],
			},
			{
				Name:        getRandomProgram(programMap),
				FundingType: fundingTypes[rand.Intn(len(fundingTypes))],
			},
		}

		capacities := []int64{15, 25, 30, 35, 40, 45}
		endDates := []time.Time{time.Now().Add(20 * 24 * time.Hour), time.Now().Add(25 * 24 * time.Hour), time.Now().Add(30 * 24 * time.Hour), time.Now().Add(35 * 24 * time.Hour)}
		instructorNames := []string{"James Anderson", "Maria Gonzalez", "Robert Smith", "Emily Johnson", "Jessica Martinez", "David Wilson", "Sarah Thompson", "Christopher Garcia", "Ashley White", "Daniel Harris"}

		for i := range prog {
			prog[i].Description = programClassDescriptions[prog[i].Name]
			if err := db.Create(&prog[i]).Error; err != nil {
				log.Fatalf("Failed to create program: %v", err)
			}
			programType := models.ProgramType{
				ProgramType: programMap[prog[i].Name],
				ProgramID:   prog[i].ID,
			}
			if err := db.Create(&programType).Error; err != nil {
				log.Fatalf("Failed to create program type: %v", err)
			}
			creditType := models.ProgramCreditType{
				CreditType: creditTypes[rand.Intn(len(creditTypes))],
				ProgramID:  prog[i].ID,
			}
			if err := db.Create(&creditType).Error; err != nil { //we can do multiple credit types if we want, add this during new development if needed
				log.Fatalf("Failed to create program credit type: %v", err)
			}
			class := models.ProgramClass{
				Capacity:       capacities[rand.Intn(len(capacities))],
				Name:           prog[i].Name,
				InstructorName: instructorNames[rand.Intn(len(instructorNames))],
				Description:    programClassDescriptions[prog[i].Name],
				Status:         models.Scheduled, //this will change during new class development
				StartDt:        time.Now().Add(14 * 24 * time.Hour),
				EndDt:          &endDates[rand.Intn(len(endDates))],
				FacilityID:     facilities[idx].ID,
				ProgramID:      prog[i].ID,
			}
			if err := db.Create(&class).Error; err != nil {
				log.Fatalf("Failed to create program class: %v", err)
			}
			log.Println("Creating program class ", class.ID)
			toReturn = append(toReturn, class)

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
			event := models.ProgramClassEvent{
				ClassID:      class.ID,
				RecurrenceRule: rule.String(),
				Room:           "Classroom #" + strconv.Itoa(rand.Intn(10)),
				Duration:       "1h0m0s",
			}
			if err := db.Create(&event).Error; err != nil {
				log.Fatalf("Failed to create event: %v", err)
			}
		}
	}
	return toReturn, nil
}

var usersStr string = `
[
  {
    "name_first": "Dr. Opal Murphy DDS",
    "name_last": "Agnes Bailey",
    "email": "cedrick.donnelly@example.org",
    "role": "student",
    "username": "RichardSchoen13",
    "facility_id": 1
  },
  {
    "name_first": "Cindy Murphy I",
    "name_last": "Ahmed Parker",
    "email": "trycia.jenkins@example.com",
    "role": "student",
    "username": "MeaganDouglas13",
    "facility_id": 1
  },
  {
    "name_first": "Mr. Garett Willms",
    "name_last": "Aracely McLaughlin",
    "email": "katrina98@example.org",
    "role": "student",
    "username": "ClaraFrami10",
    "facility_id": 1
  },
  {
    "name_first": "Rebeka Gleichner",
    "name_last": "Ardith Becker",
    "email": "ygulgowski@example.net",
    "role": "student",
    "username": "OpheliaNienow13",
    "facility_id": 1
  },
  {
    "name_first": "Miss Loyce Borer",
    "name_last": "Arely King",
    "email": "gustave59@example.org",
    "role": "student",
    "username": "OrvalKoelpin12",
    "facility_id": 1
  },
  {
    "name_first": "Keaton Waters",
    "name_last": "Ashleigh Kunde Jr.",
    "email": "smorar@example.com",
    "role": "student",
    "username": "LavadaLittel12",
    "facility_id": 1
  },
  {
    "name_first": "Eliseo Reichert",
    "name_last": "Earline Ruecker",
    "email": "rbarton@example.net",
    "role": "student",
    "username": "JulietFriesen13",
    "facility_id": 2
  },
  {
    "name_first": "Santino Kautzer",
    "name_last": "Elwyn Kreiger Jr.",
    "email": "alexandre.bergstrom@example.org",
    "role": "student",
    "username": "HeidiVonRueden14",
    "facility_id": 2
  },
  {
    "name_first": "Raina Upton",
    "name_last": "Euna Halvorson",
    "email": "grimes.olin@example.org",
    "role": "student",
    "username": "AshleeGaylord13",
    "facility_id": 2
  }
]`
var coursesStr string = `
[
	{
		"provider_platform_id": 1,
		"name": "Introduction to Botany",
		"description": "This course covers the basics of plant biology, including plant structure, function, growth, and reproduction.",
		"external_id": "98",
		"thumbnail_url": "https://d2r55xnwy6nx47.cloudfront.net/uploads/2023/12/YIR-BIOLOGY-IbrahimRayintakath-Lede-scaled.webp",
		"type": "open_enrollment",
		"outcome_types": "grade,college_credit",
		"external_url": "https://canvas.staging.unlockedlabs.xyz/courses/105",
		"alt_name": "BOT101",
		"total_progress_milestones": 12,
		"start_dt": "2024-09-01T00:00:00.000Z",
		"end_dt": "2025-01-05T00:00:00.000Z"
	},
	{
		"provider_platform_id": 1,
		"name": "Criminology and Justice",
		"description": "Explore the causes, consequences, and prevention of criminal behavior through a study of the justice system.",
		"external_id": "101",
		"thumbnail_url": "https://news.fsu.edu/wp-content/uploads/2017/11/Seal-criminology-3x2.jpg",
		"type": "open_enrollment",
		"outcome_types": "grade,college_credit",
		"external_url": "https://canvas.staging.unlockedlabs.xyz/courses/106",
		"alt_name": "CRJ201",
		"total_progress_milestones": 10,
		"start_dt": "2024-11-15T00:00:00.000Z",
		"end_dt": "2024-12-15T00:00:00.000Z"
	},
	{
		"provider_platform_id": 1,
		"name": "Introduction to Philosophy",
		"description": "Delve into fundamental philosophical questions and explore various philosophical traditions and theories.",
		"external_id": "103",
		"thumbnail_url": "https://miro.medium.com/v2/resize:fit:938/1*ARpXbGZtzKkHbojQkawQKQ.jpeg",
		"type": "open_enrollment",
		"outcome_types": "grade,college_credit",
		"external_url": "https://canvas.staging.unlockedlabs.xyz/courses/104",
		"alt_name": "PHI101",
		"total_progress_milestones": 10,
		"start_dt": "2024-10-07T00:00:00.000Z",
		"end_dt": "2025-03-04T00:00:00.000Z"
	},
	{
		"provider_platform_id": 1,
		"name": "Advanced Mathematics",
		"description": "A comprehensive study of advanced mathematical concepts including calculus, linear algebra, and differential equations.",
		"external_id": "258",
		"thumbnail_url": "https://news.harvard.edu/wp-content/uploads/2022/11/iStock-mathproblems.jpg",
		"type": "fixed_enrollment",
		"outcome_types": "grade,college_credit",
		"external_url": "https://canvas.staging.unlockedlabs.xyz/courses/104",
		"alt_name": "MATH301",
		"total_progress_milestones": 10,
		"start_dt": "2024-09-22T00:00:00.000Z",
		"end_dt": "2025-02-25T00:00:00.000Z"
	},
	{
		"provider_platform_id": 1,
		"name": "Introduction to Computer Science",
		"description": "An introductory course in computer science, covering fundamental concepts such as algorithms, data structures, and software engineering.",
		"external_id": "176",
		"thumbnail_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Computer_science_and_engineering.jpg/640px-Computer_science_and_engineering.jpg",
		"type": "open_enrollment",
		"outcome_types": "grade,college_credit",
		"external_url": "https://canvas.staging.unlockedlabs.xyz/courses/106",
		"alt_name": "CS101",
		"total_progress_milestones": 12,
		"start_dt": "2024-11-08T00:00:00.000Z",
		"end_dt": "2025-06-05T00:00:00.000Z"
	},
	{
		"provider_platform_id": 1,
		"name": "Basics of Marketing",
		"description": "Learn the fundamental principles of marketing, including market research, branding, and consumer behavior.",
		"external_id": "754",
		"thumbnail_url": "https://builtin.com/sites/www.builtin.com/files/styles/ckeditor_optimize/public/inline-images/marketing-pillar-page-marketing-overview_0.png",
		"type": "open_enrollment",
		"outcome_types": "grade,college_credit",
		"external_url": "https://canvas.staging.unlockedlabs.xyz/courses/105",
		"alt_name": "MKT101",
		"total_progress_milestones": 8,
		"start_dt": "2024-10-27T00:00:00.000Z",
		"end_dt": "2025-05-05T00:00:00.000Z"
	},
	{
		"provider_platform_id": 1,
		"name": "Introduction to Psychology",
		"description": "A comprehensive introduction to the science of psychology, including the study of mental processes and behavior.",
		"external_id": "886",
		"thumbnail_url": "https://www.udc.edu/social-udc/wp-content/uploads/sites/24/2018/03/Importance-of-Psychology_UDC.jpg",
		"type": "open_enrollment",
		"outcome_types": "grade,college_credit",
		"external_url": "https://canvas.staging.unlockedlabs.xyz/courses/106",
		"alt_name": "PSY101",
		"total_progress_milestones": 8,
		"start_dt": "2024-12-01T00:00:00.000Z",
		"end_dt": "2025-05-05T00:00:00.000Z"
	},
	{
		"provider_platform_id": 1,
		"name": "Environmental Science",
		"description": "Examine the interactions between the natural environment and human activity, focusing on sustainability and conservation.",
		"external_id": "1055",
		"thumbnail_url": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNxnwEFPxa4ujQwSb3ebJQ0qScgFz7CEY14g&s",
		"type": "open_enrollment",
		"outcome_types": "grade,college_credit",
		"external_url": "https://canvas.staging.unlockedlabs.xyz/courses/105",
		"alt_name": "ENV201",
		"total_progress_milestones": 14,
		"start_dt": "2024-01-15T00:00:00.000Z",
		"end_dt": "2025-05-01T00:00:00.000Z"
	},
	{
		"provider_platform_id": 1,
		"name": "Fundamentals of Physics",
		"description": "Learn the basic principles of physics, including motion, energy, and the properties of matter.",
		"external_id": "104",
		"thumbnail_url": "https://media-cldnry.s-nbcnews.com/image/upload/newscms/2018_22/2451826/180601-atomi-mn-1540.jpg",
		"type": "open_enrollment",
		"outcome_types": "grade,college_credit",
		"external_url": "https://canvas.staging.unlockedlabs.xyz/courses/104",
		"alt_name": "PHY101",
		"total_progress_milestones": 11,
		"start_dt": "2024-08-01T00:00:00.000Z",
		"end_dt": "2024-10-05T00:00:00.000Z"
	},
	{
		"provider_platform_id": 1,
		"name": "Modern Art History",
		"description": "Explore the history and development of modern art from the late 19th century to the present.",
		"external_id": "106",
		"thumbnail_url": "https://www.invaluable.com/blog/wp-content/plugins/inv_art-history-timeline/images/2x/04-renaissance.jpg",
		"type": "open_enrollment",
		"outcome_types": "grade,college_credit",
		"external_url": "https://canvas.staging.unlockedlabs.xyz/courses/106",
		"alt_name": "ART201",
		"total_progress_milestones": 10,
		"start_dt": "2025-02-01T00:00:00.000Z",
		"end_dt": "2025-06-05T00:00:00.000Z"
	}
]`
