package main

import (
	"UnlockEdv2/src/models"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"

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
}

/**
* Initializes a new KolibriService struct with the base URL of the Kolibri server
* Pulls the login info from ENV variables. In production, these should be set
* in /etc/environment
**/
func NewKolibriService(provider *models.ProviderPlatform) *KolibriService {
	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	password := os.Getenv("KOLIBRI_DB_PASSWORD")
	dsn := fmt.Sprintf("host=%s user=kolibri password=%s dbname=kolibri port=%s sslmode=disable TimeZone=UTC", host, password, port)
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
	}
}

/**
* Method to list all users in a Kolibri facility
* @info - GET /api/auth/facilityuser?member_of=<facilityID>
* @return - List of KolibriUser objects, representing all users in the facility
**/
func (ks *KolibriService) GetUsers(db *gorm.DB) ([]models.ImportUser, error) {
	// query kolibri database directly for users
	query := `SELECT full_name, username, id FROM kolibriauth_facilityuser WHERE facility_id = ?`
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

func (ks *KolibriService) ImportMilestonesForProgramUser(courseId, userId uint, db *gorm.DB) error {
	// sql := `SELECT id, complete, time_spent FROM logger_attemptlog where user_id = ? AND content_id = ?`
	return nil
}

type KolibriActivity struct {
	UserId              string `json:"user_id"`
	TimeSpent           string `json:"time_spent"`
	CompletionTimestamp string `json:"completion_timestamp"`
	ContentId           string `json:"content_id"`
	Progress            string `json:"progress"`
	Kind                string `json:"kind"`
}

func (ks *KolibriService) ImportActivityForProgram(courseId string, db *gorm.DB) error {
	courseID, err := strconv.Atoi(courseId)
	if err != nil {
		log.Errorln("error parsing course id in ImportActivityForProgram")
		return err
	}
	var activities []KolibriActivity
	var programId string
	if err := db.Model(&models.Program{}).Select("external_id").First(&programId, "course_id = ? AND provider_platform_id = ?", courseId, ks.ProviderPlatformID).Error; err != nil {
		log.Errorln("error finding program by external id in ImportActivityForProgram")
		return err
	}
	sql := `SELECT user_id, time_spent, completion_timestamp, content_id, progress, kind FROM logger_contentsummarylog WHERE channel_id = ?`
	if err := ks.db.Raw(sql, courseId).Find(&activities).Error; err != nil {
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
		newActivity := models.Activity{
			UserID:    user_id,
			ProgramID: uint(courseID),
			Type:      kind,
			TimeDelta: uint(time),
		}
		if err := db.Create(&newActivity).Error; err != nil {
			log.Errorln("error creating activity in ImportActivityForProgram")
			continue
		}
	}
	return nil
}
