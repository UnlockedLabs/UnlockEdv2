package main

import (
	"UnlockEdv2/src/models"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	log "github.com/sirupsen/logrus"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

/***
* Our service struct which will have the methods to interact with
* the Kolibri API and the neccessary fields, headers, cookies to make requests
***/
type KolibriService struct {
	ProviderPlatformID uint
	BaseURL            string
	Client             *http.Client
	AccountID          string
	db                 *gorm.DB
	JobParams          *map[string]interface{}
}

/**
* Initializes a new KolibriService struct with the base URL of the Kolibri server
* Pulls the login info from ENV variables. In production, these should be set
* in /etc/environment
**/
func NewKolibriService(provider *models.ProviderPlatform, params *map[string]interface{}) *KolibriService {
	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	password := os.Getenv("KOLIBRI_DB_PASSWORD")
	dsn := fmt.Sprintf("host=%s user=kolibri password=%s dbname=kolibri port=%s sslmode=disable TimeZone=America/New_York", host, password, port)
	conn, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Errorln("error connecting to db in NewKolibriService")
		return nil
	}
	log.Info("Connected to Kolibri's database")
	return &KolibriService{
		ProviderPlatformID: provider.ID,
		AccountID:          provider.AccountID,
		db:                 conn,
		JobParams:          params,
	}
}

func (ks *KolibriService) GetJobParams() *map[string]interface{} {
	return ks.JobParams
}

/**
* Method to list all users in a Kolibri facility
* @info - GET /api/auth/facilityuser?member_of=<facilityID>
* @return - List of KolibriUser objects, representing all users in the facility
**/
func (ks *KolibriService) GetUsers(db *gorm.DB) ([]models.ImportUser, error) {
	// query kolibri database directly for users
	query := `SELECT full_name, username, id FROM kolibriauth_facilityuser`
	var users []map[string]string
	if err := ks.db.Raw(query, ks.AccountID).Find(&users).Error; err != nil {
		log.Errorln("error querying kolibri database for users")
		return nil, err
	}
	var importUsers []models.ImportUser
	for _, user := range users {
		if db.Where("provider_platform_id = ? AND external_user_id = ?", ks.ProviderPlatformID, user["id"]).First(&models.ProviderUserMapping{}).Error == nil {
			continue
		}
		split := strings.Split(user["full_name"], " ")
		first, last := split[0], split[1]
		importUsers = append(importUsers, models.ImportUser{
			NameFirst:      first,
			NameLast:       last,
			Username:       user["username"],
			Email:          user["username"] + "@unlocked.v2",
			ExternalUserID: user["id"],
		})
	}
	return importUsers, nil
}

/**
* @info - GET /api/content/channel?available=true
* @return - List of maps, each containing the details of a Content object
**/
func (ks *KolibriService) ImportPrograms(db *gorm.DB) error {
	log.Println("Importing programs from Kolibri")
	var programs []map[string]interface{}
	sql := `SELECT id, author, name, description, thumbnail, total_resource_count, public, root_id FROM content_channelmetadata`
	if err := ks.db.Raw(sql).Find(&programs).Error; err != nil {
		log.Errorln("error querying kolibri database for programs")
		return err
	}
	log.Println(programs)
	for _, program := range programs {
		id := program["id"].(string)
		if db.Where("provider_platform_id = ? AND external_id = ?", ks.ProviderPlatformID, id).First(&models.Program{}).Error == nil {
			continue
		}
		query := `SELECT COUNT(*) FROM content_contentnode WHERE channel_id = ?`
		var count int
		if err := ks.db.Raw(query, id).Find(&count).Error; err != nil {
			log.Errorln("error querying kolibri database for program content count")
			continue
		}
		prog := ks.IntoCourse(program)
		if err := db.Create(&prog).Error; err != nil {
			log.Errorln("error creating program in db")
			continue
		}
	}
	return nil
}

func (ks *KolibriService) ImportMilestonesForProgramUser(programPair map[string]interface{}, mapping *models.ProviderUserMapping, db *gorm.DB, lastRun time.Time) error {
	// sql := `SELECT id, complete, time_spent FROM logger_attemptlog where user_id = ? AND content_id = ?`
	return nil
}

type KolibriActivity struct {
	ID                  string `json:"id"`
	UserId              string `json:"user_id"`
	TimeSpent           string `json:"time_spent"`
	CompletionTimestamp string `json:"completion_timestamp"`
	ContentId           string `json:"content_id"`
	Progress            string `json:"progress"`
	Kind                string `json:"kind"`
}

func (ks *KolibriService) ImportActivityForProgram(programIdPair map[string]interface{}, db *gorm.DB) error {
	programId := int(programIdPair["id"].(float64))
	externalId := programIdPair["external_id"].(string)
	sql := `SELECT id, user_id, time_spent, completion_timestamp, content_id, progress, kind FROM logger_contentsummarylog WHERE channel_id = ?`
	var activities []KolibriActivity
	if err := ks.db.Raw(sql, externalId).Find(&activities).Error; err != nil {
		log.Errorln("error querying kolibri database for program activities")
		return err
	}
	for _, activity := range activities {
		var user_id uint
		if err := db.Model(&models.ProviderUserMapping{}).Select("user_id").First(&user_id, "external_user_id = ?", activity.UserId).Error; err != nil {
			log.Errorln("error finding user by external id in ImportActivityForProgram")
			continue
		}
		kinds := map[string]models.ActivityType{
			"video":    models.ContentInteraction,
			"exercise": models.ProgramInteraction,
			"html5":    models.ContentInteraction,
			"h5p":      models.ContentInteraction,
			"topic":    models.ProgramInteraction,
		}
		time, err := strconv.ParseFloat(activity.TimeSpent, 64)
		if err != nil {
			log.Errorln("error parsing time spent in ImportActivityForProgram")
			continue
		}
		kind, ok := kinds[activity.Kind]
		if !ok {
			kind = models.ContentInteraction
		}
		if err := db.Exec("SELECT insert_daily_activity(?, ?, ?, ?, ?)", user_id, programId, kind, time, activity.ID).Error; err != nil {
			log.WithFields(log.Fields{"userId": user_id, "program_id": programId, "error": err}).Error("Failed to create activity")
			continue
		}
	}
	return nil
}
