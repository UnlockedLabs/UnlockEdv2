package main

import (
	"UnlockEdv2/src/config"
	"UnlockEdv2/src/handlers"
	"UnlockEdv2/src/models"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"strconv"
	"strings"
	"time"

	"github.com/go-faker/faker/v4"
	"github.com/go-faker/faker/v4/pkg/options"
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
	if err := godotenv.Load(); err != nil {
		log.Printf("Error loading .env file: %v", err)
	}
	cfg, err := config.LoadBackendConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}
	models.SetAppKey(cfg.AppKey)
	models.SetKiwixLibraryURL(cfg.KiwixServerURL)

	dsn := buildDSN(cfg)
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN: dsn,
	}), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to the PostgreSQL database: %v", err)
	}
	seedTestData(db, cfg)
}

func seedTestData(db *gorm.DB, cfg *config.Config) {
	var err error
	// isTesting is false because this needs to seed real users w/ kratos
	testServer := handlers.NewServer(false, context.Background(), cfg)
	facilities := []models.Facility{
		{
			Name:     "BCF",
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
	platforms := []models.ProviderPlatform{}
	platforms = []models.ProviderPlatform{
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

	facilities = []models.Facility{}
	err = db.Find(&facilities).Error
	if err != nil {
		log.Printf("Failed to get facilities: %v", err)
	}
	videos := []models.Video{}
	libraries := []models.Library{}
	libraries = generateFakeLibraries(2, 25)
	videos = generateFakeVideos(3, 25)
	for i := range videos {
		// create open_content_url for each video
		_ = db.Create(&models.OpenContentUrl{
			ContentURL: fmt.Sprintf("/api/proxy/videos/%d", videos[i].ID),
		}).Error
	}

	for i := range videos {
		if err := db.Create(&videos[i]).Error; err != nil {
			log.Printf("Failed to create fake video: %v", err)
		}
	}
	for i := range libraries {
		if err := db.Create(&libraries[i]).Error; err != nil {
			log.Printf("Failed to create fake library: %v", err)
		}
	}
	users := generateFakeUsers(facilities)
	for idx := range users {
		log.Printf("Creating user %s", users[idx].Username)
		if err := db.Create(&users[idx]).Error; err != nil {
			log.Printf("Failed to create user: %v", err)
		}
		if err := testServer.HandleCreateUserKratos(users[idx].Username, "ChangeMe!"); err != nil {
			log.Fatalf("unable to create test user in kratos")
		}
		for i := range len(platforms) {
			if platforms[i].Type != models.Brightspace { //omitting brightspace here, we don't want bad users in the seeded data...we want real users
				mapping := models.ProviderUserMapping{
					UserID:             users[idx].ID,
					ProviderPlatformID: platforms[i].ID,
					ExternalUsername:   users[idx].Username,
					ExternalUserID:     strconv.Itoa(idx) + strconv.Itoa(rand.Intn(30000)),
				}
				if err = db.Create(&mapping).Error; err != nil {
					log.Printf("Failed to create provider user mapping: %v", err)
				}
			}
		}
	}
	courses := []models.Course{}
	if err := json.Unmarshal([]byte(coursesStr), &courses); err != nil {
		log.Printf("Failed to unmarshal test data: %v", err)
	}
	for idx := range courses {
		if err := db.Create(&courses[idx]).Error; err != nil {
			log.Printf("Failed to create course: %v", err)
		}
	}
	outcomes := []string{"college_credit", "grade", "certificate", "pathway_completion"}
	milestoneTypes := []models.MilestoneType{models.DiscussionPost, models.AssignmentSubmission, models.QuizSubmission, models.GradeReceived}

	var adminUser models.User
	if db.Where("role = ?", models.SystemAdmin).Limit(1).Find(&adminUser).Error != nil {
		log.Fatalf("Failed to get users from db")
		return
	}
	classes := []models.ProgramClass{}
	classes, err = createFacilityPrograms(db, adminUser.ID)
	if err != nil {
		log.Printf("Failed to create facility programs: %v", err)
	}
	events := []models.ProgramClassEvent{}
	if err := db.Find(&events).Error; err != nil {
		log.Fatalf("Failed to get events from db")
	}
	for _, user := range users {
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
			for i := range 365 {
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
		statuses := [6]models.ProgramEnrollmentStatus{
			models.EnrollmentCancelled,
			models.EnrollmentCompleted,
			models.EnrollmentIncompleteWithdrawn,
			models.EnrollmentIncompleteDropped,
			models.EnrollmentIncompleteFailedToComplete,
			models.EnrollmentIncompleteTransfered,
		}

		numEnrollments := rand.Intn(3) + 1
		available := []models.ProgramClass{}
		for i := range classes {
			if classes[i].FacilityID == user.FacilityID {
				available = append(available, classes[i])
			}
		}
		rand.Shuffle(len(available), func(i, j int) { available[i], available[j] = available[j], available[i] })
		for _, cls := range available[:min(numEnrollments, len(available))] {
			status := models.Enrolled
			if rand.Intn(100)%2 == 0 {
				status = statuses[rand.Intn(len(statuses))]
			}
			enrollment := models.ProgramClassEnrollment{
				UserID:           user.ID,
				ClassID:          cls.ID,
				EnrollmentStatus: status,
			}
			if err := db.Create(&enrollment).Error; err != nil {
				log.Printf("Failed to create enrollment: %v", err)
			}
			if status == models.EnrollmentCompleted {
				completion := models.ProgramCompletion{
					UserID:              user.ID,
					ProgramClassID:      cls.ID,
					ProgramID:           cls.ProgramID,
					ProgramName:         faker.Sentence(options.WithRandomStringLength(16)),
					FacilityName:        facilities[user.FacilityID-1].Name,
					ProgramOwner:        faker.Name(),
					ProgramClassName:    cls.Name,
					ProgramClassStartDt: cls.StartDt,
				}
				if err := db.Create(&completion).Error; err != nil {
					log.Printf("Failed to create completion")
				}
			}
			log.Printf("Creating program enrollment for user %s", user.Username)
		}
		attendanceStatus := []models.Attendance{
			models.Present,
			models.Absent_Excused,
			models.Absent_Unexcused,
		}
		for _, event := range events {
			rule, err := rrule.StrToRRule(event.RecurrenceRule)
			if err != nil {
				log.Printf("Failed to parse rrule for event %d: %v", event.ID, err)
				continue
			}
			occurrences := rule.Between(startDate, endDate, true)
			for _, occ := range occurrences {
				if rand.Intn(10)%2 == 0 {
					continue
				}
				attendanceDate := occ.Format("2006-01-02")
				attendance := models.ProgramClassEventAttendance{
					EventID:          event.ID,
					UserID:           user.ID,
					Date:             attendanceDate,
					AttendanceStatus: attendanceStatus[rand.Intn(len(attendanceStatus))],
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
	createUserSessionActivity(db, users)
}

func buildDSN(cfg *config.Config) string {
	if cfg.AppDSN != "" {
		return cfg.AppDSN
	}
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=prefer",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName)
}

func createUserSessionActivity(db *gorm.DB, dbUsers []models.User) {
	now := time.Now()
	threeMonthsInPast := now.AddDate(0, -3, 0)
	for _, user := range dbUsers {
		burstCount := rand.Intn(6) + 3 // 3–8 session bursts
		for range burstCount {
			base := threeMonthsInPast.Add(time.Duration(rand.Intn(90*24)) * time.Hour)
			sessionsInBurst := rand.Intn(4) + 1
			for j := range sessionsInBurst {
				start := base.Add(time.Duration(j*2) * time.Hour)
				duration := time.Duration(rand.Intn(60)+15) * time.Minute
				end := start.Add(duration)
				userSessionTracking := models.UserSessionTracking{
					UserID:         user.ID,
					SessionStartTS: start,
					SessionEndTS:   end,
					SessionID:      fmt.Sprintf("%s-%d", start.Format("20060102"), rand.Intn(10000)),
				}
				if err := db.Create(&userSessionTracking).Error; err != nil {
					log.Printf("Failed to create userSessionTracking: %v", err)
				}
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
		log.Printf("Failed to get libraries: %v", err)
	}
	var videos []models.Video
	if err := db.Model(&models.Video{}).Find(&videos).Error; err != nil {
		log.Printf("Failed to get videos: %v", err)
	}
	generateOpenContentFavorites(db, dbUsers, libraries, videos)
	for _, user := range dbUsers {
		if user.Role != "student" {
			continue
		}
		for _, video := range videos {
			numSessions := rand.Intn(20)
			for range numSessions {
				if rand.Intn(100)%3 == 0 {
					randomDayOffset := rand.Intn(int(now.Sub(threeMonthsInPast).Hours() / 24))
					requestDate := threeMonthsInPast.Add(time.Duration(randomDayOffset*24) * time.Hour)
					requestHour := rand.Intn(23)
					requestMinute := rand.Intn(60)
					requestSecond := rand.Intn(60)
					requestTS := time.Date(requestDate.Year(), requestDate.Month(), requestDate.Day(), requestHour, requestMinute, requestSecond, 0, time.UTC)
					stopTS := requestTS.Add(time.Duration(rand.Intn(360)) * time.Minute)
					contentActivity := models.OpenContentActivity{
						OpenContentUrlID:      getRandomURLForLibrary(openContentUrls),
						RequestTS:             requestTS,
						OpenContentProviderID: video.OpenContentProviderID,
						FacilityID:            user.FacilityID,
						UserID:                user.ID,
						ContentID:             video.ID,
						StopTS:                stopTS,
					}
					if err := db.Create(&contentActivity).Error; err != nil {
						log.Printf("Failed to create open content activity: %v", err)
					}
				}
			}
		}
		for _, kiwix := range libraries {
			numSessions := rand.Intn(20)
			for range numSessions {
				if rand.Intn(100)%3 == 0 {
					// Select random facility, provider, and content
					urlID := getRandomURLForLibrary(openContentUrls)
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
}

func getRandomURLForLibrary(urls []models.OpenContentUrl) uint {
	selectedURL := urls[rand.Intn(len(urls))]
	return selectedURL.ID
}

func generateOpenContentFavorites(db *gorm.DB, users []models.User, libraries []models.Library, videos []models.Video) {
	var urls []models.OpenContentUrl

	if err := db.Find(&urls).Error; err != nil {
		log.Printf("Failed to fetch open content URLs: %v", err)
		return
	}
	for _, user := range users {
		if user.Role != "student" {
			continue
		}
		numFavorites := rand.Intn(8) + 3 // 3-10 favorites
		for range numFavorites {
			isLibrary := rand.Intn(2) == 0
			var fav models.OpenContentFavorite

			if isLibrary && len(libraries) > 0 {
				lib := libraries[rand.Intn(len(libraries))]
				var urlID *uint
				for _, url := range urls {
					if strings.Contains(url.ContentURL, fmt.Sprintf("/libraries/%d/", lib.ID)) {
						urlID = &url.ID
						break
					}
				}

				fav = models.OpenContentFavorite{
					UserID:                user.ID,
					ContentID:             lib.ID,
					OpenContentProviderID: lib.OpenContentProviderID,
					OpenContentUrlID:      urlID,
					Name:                  lib.Title,
					CreatedAt:             time.Now().AddDate(0, 0, -rand.Intn(90)),
				}
			} else if len(videos) > 0 {
				vid := videos[rand.Intn(len(videos))]
				fav = models.OpenContentFavorite{
					UserID:                user.ID,
					ContentID:             vid.ID,
					OpenContentProviderID: vid.OpenContentProviderID,
					OpenContentUrlID:      nil, // videos never have one
					Name:                  vid.Title,
					CreatedAt:             time.Now().AddDate(0, 0, -rand.Intn(90)),
				}
			} else {
				continue
			}

			if err := db.Create(&fav).Error; err != nil {
				log.Printf("Failed to create favorite: %v", err)
			}
		}
	}
}
func getRandomProgram(programMap map[string]models.ProgType) string {
	keySlice := make([]string, 0, len(programMap))
	for key := range programMap {
		keySlice = append(keySlice, key)
	}
	return keySlice[rand.Intn(len(keySlice))]
}

func generateFakeLibraries(providerID uint, count int) []models.Library {
	langs := []string{"eng", "spa", "fra", "por", "deu"}
	libraries := make([]models.Library, 0, count)
	for range count {
		lang := langs[rand.Intn(len(langs))]
		title := faker.Word() + " Docs"
		lib := models.Library{
			OpenContentProviderID: providerID,
			ExternalID:            models.StringPtr(fmt.Sprintf("urn:uuid:%s", faker.UUIDDigit())),
			Title:                 title,
			Language:              models.StringPtr(lang),
			Description:           models.StringPtr(faker.Paragraph()),
			Url:                   fmt.Sprintf("/content/devdocs_en_%s_%s", strings.ToLower(faker.Word()), "2025-01"),
			ThumbnailUrl:          models.StringPtr("/kiwix.jpg"),
		}
		libraries = append(libraries, lib)
	}
	return libraries
}

func generateFakeVideos(providerID uint, count int) []models.Video {
	videos := make([]models.Video, 0, count)
	for range count {
		title := faker.Sentence()
		channel := faker.Name()
		video := models.Video{
			ExternalID:            fmt.Sprintf("vid-%d-%s", rand.Intn(999999), faker.Word()),
			Url:                   fmt.Sprintf("https://video.example.com/watch?v=%d", rand.Intn(999999)),
			Title:                 title,
			Availability:          models.VideoAvailable,
			ChannelTitle:          &channel,
			Duration:              rand.Intn(7200) + 60, // 1–120 mins
			Description:           faker.Paragraph(),
			ThumbnailUrl:          fmt.Sprintf("https://img.example.com/thumbs/%d.jpg", rand.Intn(999999)),
			OpenContentProviderID: providerID,
		}
		videos = append(videos, video)
	}
	return videos
}
func createFacilityPrograms(db *gorm.DB, adminID uint) ([]models.ProgramClass, error) {
	facilities := []models.Facility{}
	fundingTypes := [6]models.FundingType{models.EduGrants, models.FederalGrants, models.InmateWelfare, models.NonProfitOrgs, models.Other, models.StateGrants}
	creditTypes := [4]models.CreditType{models.Completion, models.EarnedTime, models.Education, models.Participation}
	programMap := map[string]models.ProgType{
		"Anger Management":          models.Therapeutic,
		"Substance Abuse Treatment": models.MentalHealth,
		"AA/NA":                     models.MentalHealth,
		"Thinking for a Change":     models.LifeSkills,
		"A New Freedom":             models.LifeSkills,
		"Dog Training":              models.Vocational,
		"A New Path":                models.Therapeutic,
		"GED/Hi-SET":                models.Educational,
		"Parenting":                 models.LifeSkills,
		"Employment":                models.Vocational,
		"Life Skills":               models.LifeSkills,
		"Health and Wellness":       models.MentalHealth,
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
	programs := make([]models.Program, 0, 7)
	for range 7 {
		programs = append(programs, models.Program{
			Name:         getRandomProgram(programMap),
			FundingType:  fundingTypes[rand.Intn(len(fundingTypes))],
			CreateUserID: adminID,
		})
	}
	for i := range programs {
		programs[i].Description = programClassDescriptions[programs[i].Name]
		programs[i].IsActive = true
		if err := db.Create(&programs[i]).Error; err != nil {
			log.Printf("Failed to create program: %v", err)
		}
		for idx := range facilities {
			capacities := []int64{15, 25, 30, 35, 40, 45}
			endDates := []time.Time{time.Now().Add(20 * 24 * time.Hour), time.Now().Add(25 * 24 * time.Hour), time.Now().Add(30 * 24 * time.Hour), time.Now().Add(35 * 24 * time.Hour)}
			facilityProgram := models.FacilitiesPrograms{
				ProgramID:    programs[i].ID,
				FacilityID:   facilities[idx].ID,
				ProgramOwner: faker.Name(),
			}
			if err := db.Create(&facilityProgram).Error; err != nil {
				log.Printf("Failed to create facility program: %v", err)
			}
			for range rand.Intn(4) {
				programType := models.ProgramType{
					ProgramType: programMap[programs[i].Name],
					ProgramID:   programs[i].ID,
				}
				if err := db.Create(&programType).Error; err != nil {
					log.Printf("Failed to create program type: %v", err)
				}
				creditType := models.ProgramCreditType{
					CreditType: creditTypes[rand.Intn(len(creditTypes))],
					ProgramID:  programs[i].ID,
				}
				if err := db.Create(&creditType).Error; err != nil { //we can do multiple credit types if we want, add this during new development if needed
					log.Printf("Failed to create program credit type: %v", err)
				}
				class := models.ProgramClass{
					Capacity:       capacities[rand.Intn(len(capacities))],
					Name:           programs[i].Name,
					InstructorName: faker.Name(),
					Description:    programClassDescriptions[programs[i].Name],
					Status:         models.Scheduled, //this will change during new class development
					StartDt:        time.Now().Add(14 * 24 * time.Hour),
					EndDt:          &endDates[rand.Intn(len(endDates))],
					FacilityID:     facilities[idx].ID,
					ProgramID:      programs[i].ID,
					CreateUserID:   adminID,
				}
				if err := db.Create(&class).Error; err != nil {
					log.Printf("Failed to create program class: %v", err)
				}
				log.Println("Creating program class ", class.ID)
				toReturn = append(toReturn, class)

				randDays := []rrule.Weekday{}
				days := []rrule.Weekday{rrule.MO, rrule.TU, rrule.WE, rrule.TH, rrule.FR, rrule.SA, rrule.SU}
				for range rand.Intn(3) {
					randDays = append(randDays, days[rand.Intn(len(days))])
				}
				rule, err := rrule.NewRRule(rrule.ROption{
					Freq:      rrule.WEEKLY,
					Dtstart:   class.StartDt,
					Until:     *class.EndDt,
					Byweekday: randDays,
				})
				if err != nil {
					log.Printf("Failed to create rrule: %v", err)
				}
				event := models.ProgramClassEvent{
					ClassID:        class.ID,
					RecurrenceRule: rule.String(),
					Room:           "Classroom #" + strconv.Itoa(rand.Intn(10)),
					Duration:       "1h0m0s",
				}
				if err := db.Create(&event).Error; err != nil {
					log.Printf("Failed to create event: %v", err)
				}
			}
		}
	}
	return toReturn, nil
}

func generateFakeUsers(facilities []models.Facility) []models.User {
	users := make([]models.User, 0, 30)
	for range 30 {
		facility := facilities[rand.Intn(len(facilities))]
		first := faker.FirstName()
		last := faker.LastName()
		username := strings.ToLower(fmt.Sprintf("%s.%s%d", first, last, rand.Intn(1000)))
		email := fmt.Sprintf("%s@unlocked.test", username)
		user := models.User{
			Username:   username,
			NameFirst:  first,
			NameLast:   last,
			Email:      email,
			Role:       "student",
			FacilityID: facility.ID,
			DocID:      strconv.Itoa(rand.Intn(100000)),
		}
		users = append(users, user)
	}
	return users
}

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
