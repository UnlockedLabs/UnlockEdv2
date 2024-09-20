package database

import (
	"UnlockEdv2/src/models"
	"database/sql"
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"sync"
	"time"

	_ "github.com/ncruces/go-sqlite3/embed"
	"github.com/ncruces/go-sqlite3/gormlite"

	"github.com/go-playground/validator/v10"
	"github.com/pressly/goose/v3"
	log "github.com/sirupsen/logrus"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type DB struct{ *gorm.DB }

var TableList = []interface{}{
	&models.User{},
	&models.ProviderPlatform{},
	&models.UserActivity{},
	&models.ProviderUserMapping{},
	&models.LeftMenuLink{},
	&models.Program{},
	&models.Milestone{},
	&models.Outcome{},
	&models.Activity{},
	&models.OidcClient{},
	&models.UserFavorite{},
	&models.Facility{},
	&models.OpenContentProvider{},
	&models.CronJob{},
	&models.RunnableTask{},
}

var validate = sync.OnceValue(func() *validator.Validate { return validator.New(validator.WithRequiredStructEnabled()) })

func InitDB(isTesting bool) *DB {
	var gormDb *gorm.DB
	var err error
	if isTesting {
		gormDb, err = gorm.Open(gormlite.Open(":memory:"), &gorm.Config{})
		if err != nil {
			log.Fatal("Failed to connect to SQLite database:", err)
		}
		log.Println("Connected to the SQLite database in memory")
		MigrateTesting(gormDb)
	} else {
		dsn := os.Getenv("APP_DSN")
		if dsn == "" {
			dsn = fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=allow",
				os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"), os.Getenv("DB_NAME"))
		}
		db, err := sql.Open("pgx", dsn)
		if err != nil {
			log.Fatalf("Failed to open database connection: %v", err)
		}
		if err := db.Ping(); err != nil {
			log.Fatalf("Failed to ping database: %v", err)
		}
		log.Println("Running up migrations...")
		migrationDir := os.Getenv("MIGRATION_DIR")
		if migrationDir == "" {
			migrationDir = "migrations"
		}
		if err := goose.Up(db, migrationDir); err != nil {
			log.Fatalf("Migration failed: %v", err)
		}
		gormDb, err = gorm.Open(postgres.New(postgres.Config{
			Conn: db,
		}), &gorm.Config{})
		if err != nil {
			log.Fatalf("Failed to connect to PostgreSQL database using GORM: %v", err)
		}
		log.Println("Connected to the PostgreSQL database via GORM")
	}
	database := &DB{gormDb}
	SeedDefaultData(gormDb, isTesting)
	if isTesting {
		database.SeedTestData()
	}
	return database
}

func MigrateTesting(db *gorm.DB) {
	for _, table := range TableList {
		log.Printf("Migrating %T table...", table)
		if err := db.AutoMigrate(table); err != nil {
			log.Fatal("Failed to migrate table: ", err)
		}
	}
}

func SeedDefaultData(db *gorm.DB, isTesting bool) {
	var count int64
	if err := db.Model(models.User{}).Where("id = ?", fmt.Sprintf("%d", 1)).Count(&count).Error; err != nil {
		log.Fatal("db transaction failed getting admin user")
	}
	if count == 0 {
		if err := db.Model(models.Facility{}).Where("id = ?", fmt.Sprintf("%d", 1)).Count(&count).Error; err != nil {
			log.Fatal("db transaction failed getting default facility")
		}
		defaultFacility := models.Facility{
			Name: "Default",
		}
		log.Printf("Creating facility: %v", defaultFacility)
		if err := db.Create(&defaultFacility).Error; err != nil {
			log.Fatalf("Failed to create user: %v", err)
		}
		user := models.User{
			Username:   "SuperAdmin",
			NameFirst:  "Super",
			NameLast:   "Admin",
			Email:      "admin@unlocked.v2",
			Role:       "admin",
			FacilityID: 1,
		}
		log.Printf("Creating user: %v", user)
		log.Println("Make sure to sync the Kratos instance if you are freshly migrating")
		if err := db.Create(&user).Error; err != nil {
			log.Fatalf("Failed to create user: %v", err)
		}

		links := []models.LeftMenuLink{}
		if err := json.Unmarshal([]byte(defaultLeftMenuLinks), &links); err != nil {
			log.Fatalf("Failed to unmarshal default left menu links: %v", err)
		}
		if err := db.Create(&links).Error; err != nil {
			log.Fatalf("Failed to create left menu links: %v", err)
		}
	}
}

const defaultLeftMenuLinks = `[{"name":"Unlocked Labs","rank":1,"links":[{"Unlocked Labs Website":"http:\/\/www.unlockedlabs.org\/"},{"Unlocked Labs LinkedIn":"https:\/\/www.linkedin.com\/company\/labs-unlocked\/"}],"created_at":null,"updated_at":null}]`

func (db *DB) SeedTestData() {
	facilitiesFile, err := os.ReadFile("test_data/facilities.json")
	if err != nil {
		log.Fatalf("Failed to read test data: %v", err)
	}
	var facilities []models.Facility
	if err := json.Unmarshal(facilitiesFile, &facilities); err != nil {
		log.Fatalf("Failed to unmarshal test data: %v", err)
	}
	for i := range facilities {
		if err := db.Create(&facilities[i]).Error; err != nil {
			log.Fatalf("Failed to create facility: %v", err)
		}
	}
	platforms, err := os.ReadFile("test_data/provider_platforms.json")
	if err != nil {
		log.Fatalf("Failed to read test data: %v", err)
	}
	var platform []models.ProviderPlatform
	if err := json.Unmarshal(platforms, &platform); err != nil {
		log.Fatalf("Failed to unmarshal test data: %v", err)
	}
	for i := range platform {
		if i%2 == 0 {
			platform[i].OidcID = 1
		}
		if err := db.Create(&platform[i]).Error; err != nil {
			log.Fatalf("Failed to create platform: %v", err)
		}
	}
	openContent, err := os.ReadFile("test_data/open_content.json")
	if err != nil {
		log.Fatalf("Failed to read test data: %v", err)
	}
	var openContentProviders []models.OpenContentProvider
	if err := json.Unmarshal(openContent, &openContentProviders); err != nil {
		log.Fatalf("Failed to unmarshal test data: %v", err)
	}
	for i := range openContentProviders {
		openContentProviders[i].ProviderPlatformID = platform[rand.Intn(len(platform))].ID
		if err := db.Create(&openContentProviders[i]).Error; err != nil {
			log.Fatalf("Failed to create open content provider: %v", err)
		}
	}
	oidcFile, err := os.ReadFile("test_data/oidc_client.json")
	if err != nil {
		log.Fatalf("Failed to read test data: %v", err)
	}
	var oidcClients []models.OidcClient
	if err := json.Unmarshal(oidcFile, &oidcClients); err != nil {
		log.Fatalf("Failed to unmarshal test data: %v", err)
	}
	for i := range oidcClients {
		oidcClients[i].ProviderPlatformID = 3
		if err := db.Create(&oidcClients[i]).Error; err != nil {
			log.Fatalf("Failed to create oidc: %v", err)
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
	for idx := range user {
		log.Printf("Creating user %s", user[idx].Username)
		if err := db.Create(&user[idx]).Error; err != nil {
			log.Fatalf("Failed to create user: %v", err)
		}
		//skip last user to be added for any mapping for testing a scenario
		if idx == len(user)-2 {
			continue
		}
		for i := range platform {
			mapping := models.ProviderUserMapping{
				UserID:             user[idx].ID,
				ProviderPlatformID: platform[i].ID,
				ExternalUsername:   user[idx].Username,
				ExternalUserID:     strconv.Itoa(idx),
			}
			if err = db.CreateProviderUserMapping(&mapping); err != nil {
				return
			}
		}
	}
	var programs []models.Program
	progs, err := os.ReadFile("test_data/programs.json")
	if err != nil {
		log.Fatalf("Failed to read test data: %v", err)
	}
	if err := json.Unmarshal(progs, &programs); err != nil {
		log.Fatalf("Failed to unmarshal test data: %v", err)
	}
	for idx := range programs {
		if err := db.Create(&programs[idx]).Error; err != nil {
			log.Fatalf("Failed to create program: %v", err)
		}
	}
	var milestones []models.Milestone
	mstones, err := os.ReadFile("test_data/milestones.json")
	if err != nil {
		log.Fatalf("Failed to read test data: %v", err)
	}
	if err := json.Unmarshal(mstones, &milestones); err != nil {
		log.Fatalf("Failed to unmarshal test data: %v", err)
	}
	for idx := range milestones {
		if err := db.Create(&milestones[idx]).Error; err != nil {
			log.Fatalf("Failed to create milestone: %v", err)
		}
	}
	outcomes := []string{"completion", "grade", "certificate", "pathway_completion"}
	for idx := range user {
		for jdx := range programs {
			for i := 0; i < 365; i++ {
				if rand.Intn(100)%2 == 0 {
					continue
				}
				startTime := 0
				randTime := rand.Intn(1000)
				// we want activity for the last year
				yearAgo := time.Now().AddDate(-1, 0, 0)
				time := yearAgo.AddDate(0, 0, i)
				activity := models.Activity{
					UserID:     user[idx].ID,
					ProgramID:  programs[jdx].ID,
					Type:       "interaction",
					TotalTime:  uint(startTime + randTime),
					TimeDelta:  uint(randTime),
					ExternalID: strconv.Itoa(rand.Intn(1000)),
					CreatedAt:  time,
				}
				startTime += randTime
				if err := db.Create(&activity).Error; err != nil {
					log.Fatalf("Failed to create activity: %v", err)
				}
			}
			outcome := models.Outcome{
				ProgramID: programs[jdx].ID,
				UserID:    user[idx].ID,
				Type:      models.OutcomeType(outcomes[rand.Intn(len(outcomes))]),
			}
			if err := db.Create(&outcome).Error; err != nil {
				log.Fatalf("Failed to create outcome: %v", err)
			}
		}
	}
}
