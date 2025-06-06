package database

import (
	"UnlockEdv2/src/models"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
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

func InitDB(isTesting bool) *DB {
	var gormDb *gorm.DB
	var err error
	if isTesting {
		gormDb, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
		if err != nil {
			logrus.Fatal("Failed to connect to SQLite database:", err)
		}
		logrus.Println("Connected to the SQLite database in memory")
		MigrateTesting(gormDb)
	} else {
		dsn := os.Getenv("APP_DSN")
		if dsn == "" {
			dsn = fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=allow",
				os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"), os.Getenv("DB_NAME"))
		}
		db, err := sql.Open("pgx", dsn)
		if err != nil {
			logrus.Fatalf("Failed to open database connection: %v", err)
		}
		if err := db.Ping(); err != nil {
			logrus.Fatalf("Failed to ping database: %v", err)
		}
		logrus.Println("Running up migrations...")
		migrationDir := os.Getenv("MIGRATION_DIR")
		if migrationDir == "" {
			migrationDir = "migrations"
		}
		if err := goose.Up(db, migrationDir); err != nil {
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
	DB.SeedDefaultData(isTesting)
	if isTesting {
		DB.SeedTestData()
	}
	return DB
}

func MigrateTesting(db *gorm.DB) {
	var TableList = []any{
		&models.Role{},
		&models.User{},
		&models.ProviderPlatform{},
		&models.ProviderUserMapping{},
		&models.HelpfulLink{},
		&models.Course{},
		&models.Program{},
		&models.ProgramClass{},
		&models.ProgramCreditType{},
		&models.ProgramType{},
		&models.ProgramClassEvent{},
		&models.ProgramClassEnrollment{},
		&models.ProgramClassEventOverride{},
		&models.ProgramClassEventAttendance{},
		&models.Milestone{},
		&models.Outcome{},
		&models.Activity{},
		&models.OidcClient{},
		&models.ProgramFavorite{},
		&models.Facility{},
		&models.FacilitiesPrograms{},
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
	for _, table := range TableList {
		logrus.Printf("Migrating %T table...", table)
		if err := db.AutoMigrate(table); err != nil {
			logrus.Fatal("Failed to migrate table: ", err)
		}
	}
	if !db.Migrator().HasColumn(&models.FacilitiesPrograms{}, "deleted_at") {
		if err := db.Migrator().AddColumn(&models.FacilitiesPrograms{}, "DeletedAt"); err != nil {
			logrus.Fatal("Failed to add deleted_at column: ", err)
		}
	}
}

func (db *DB) SeedDefaultData(isTesting bool) {
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
		for idx := range defaultOpenContentProviders {
			if err := db.Create(&defaultOpenContentProviders[idx]).Error; err != nil {
				logrus.Fatalf("Failed to create default open content providers: %v", err)
			}
		}
	}
	if err := initProgramMaterializedViews(db.DB); err != nil {
		logrus.Fatalf("Failed to initialize program materialized views: %v", err)
	}
}

func initProgramMaterializedViews(db *gorm.DB) error {
	const sqlTemplate = `CREATE MATERIALIZED VIEW programs_overview_%s AS
WITH recent_metrics AS (
  SELECT
    program_id,
    total_enrollments,
    total_active_enrollments,
    total_classes,
    total_active_facilities
  FROM daily_program_facilities_history
  WHERE date = (SELECT MAX(date) FROM daily_program_facilities_history)
),
program_attendance AS (
  SELECT
    program_id,
    SUM(total_completions) AS total_completions,
    SUM(total_enrollments) AS sum_enrollments,
    SUM(total_students_present) AS total_students_present,
    SUM(total_attendances_marked) AS sum_attendances
  FROM daily_program_facilities_history
  %s
  GROUP BY program_id
),
program_type_agg AS (
  SELECT
    program_id,
    STRING_AGG(DISTINCT program_type::text, ',') AS program_types
  FROM program_types
  GROUP BY program_id
),
credit_type_agg AS (
  SELECT
    program_id,
    STRING_AGG(DISTINCT credit_type::text, ',') AS credit_types
  FROM program_credit_types
  GROUP BY program_id
)
SELECT
  p.id AS program_id,
  p.name AS program_name,
  p.description,
  p.archived_at,
  rm.total_enrollments,
  rm.total_active_enrollments,
  rm.total_classes,
  rm.total_active_facilities,
  (pa.total_completions * 1.0 / NULLIF(pa.sum_enrollments, 0)) * 100 AS completion_rate,
  (pa.total_students_present * 1.0 / NULLIF(pa.sum_attendances, 0)) * 100 AS attendance_rate,
  p.funding_type,
  BOOL_OR(p.is_active) AS status,
  pt.program_types,
  ct.credit_types
FROM programs p
LEFT JOIN recent_metrics rm ON rm.program_id = p.id
LEFT JOIN program_attendance pa ON pa.program_id = p.id
LEFT JOIN program_type_agg pt ON pt.program_id = p.id
LEFT JOIN credit_type_agg ct ON ct.program_id = p.id
GROUP BY p.id, p.name, p.archived_at, p.funding_type,
         rm.total_enrollments, rm.total_active_enrollments, rm.total_classes, rm.total_active_facilities,
         pa.total_completions, pa.sum_enrollments, pa.total_students_present, pa.sum_attendances,
         pt.program_types, ct.credit_types;`

	timeWindows := map[string]string{
		"30d":      "WHERE date >= CURRENT_DATE - INTERVAL '30 days'",
		"90d":      "WHERE date >= CURRENT_DATE - INTERVAL '90 days'",
		"all_time": "", // no WHERE clause
	}

	indexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_programs_overview_%s_archived_at ON programs_overview_%s(archived_at)`,
		`CREATE INDEX IF NOT EXISTS idx_programs_overview_%s_name_lower ON programs_overview_%s(LOWER(program_name))`,
		`CREATE INDEX IF NOT EXISTS idx_programs_overview_%s_description ON programs_overview_%s(LOWER(description))`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_programs_overview_%s_unique ON programs_overview_%s(program_id)`,
	}

	for name, whereClause := range timeWindows {
		viewName := fmt.Sprintf("programs_overview_%s", name)

		var exists bool
		checkView := `
			SELECT EXISTS (
				SELECT 1 FROM pg_matviews
				WHERE matviewname = ?
			)
		`
		if err := db.Raw(checkView, viewName).Scan(&exists).Error; err != nil {
			return fmt.Errorf("checking view existence for %s: %w", viewName, err)
		}
		if !exists {
			logrus.Infof("Creating materialized view: %s", viewName)
			viewSQL := fmt.Sprintf(sqlTemplate, name, whereClause)
			if err := db.Exec(viewSQL).Error; err != nil {
				return fmt.Errorf("creating view %s: %w", viewName, err)
			}
		}

		for _, idx := range indexes {
			stmt := fmt.Sprintf(idx, name, name)
			if err := db.Exec(stmt).Error; err != nil {
				return fmt.Errorf("creating index for %s: %w", viewName, err)
			}
		}
	}
	return nil
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
