package main

import (
	"UnlockEdv2/src/models"
	"fmt"
	"net/http"
	"os"
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
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC", host, "kolibri", password, "kolibri", port)
	conn, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Errorln("error connecting to db in NewKolibriService")
		return nil
	}
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

func (ks *KolibriService) CreateUserInKolibri(db *gorm.DB, userId int) error {
	var user models.User
	if err := db.Find(&user, "id = ?", userId).Error; err != nil {
		log.Errorln("error finding user by id CreateUserInKolibri")
		return err
	}
	kUser := make(map[string]interface{}, 0)
	kUser["facility"] = ks.AccountID
	kUser["full_name"] = user.NameFirst + user.NameLast
	kUser["password"] = "NOT_SPECIFIED"
	kUser["username"] = user.Username
	kUser["id_number"] = fmt.Sprintf("%d", user.ID)
	kUser["gender"] = "Male"
	kUser["birth_year"] = "1992"
	kUser["extra_demographics"] = make(map[string]interface{})
	return nil
}

/**
* @info - GET /api/content/channel?available=true
* @return - List of maps, each containing the details of a Content object
**/
func (ks *KolibriService) ImportPrograms(db *gorm.DB) error {
	// var programs []KolibriContent
	// sql := `SELECT id, author, name, description, thumbnail, total_resource_count, public, root_id FROM content_channelmetadata`
	// if err := ks.db.Raw(sql).Find(&programs).Error; err != nil {
	// 	log.Errorln("error querying kolibri database for programs")
	// 	return err
	// }
	// for _, program := range programs {
	// 	if db.Where("provider_platform_id = ? AND external_id = ?", ks.ProviderPlatformID, program.ID).First(&models.Program{}).Error == nil {
	// 		continue
	// 	}
	//    query := `SELECT COUNT(*) FROM content_contentnode WHERE channel_id = ?`
	//    var count int
	//    if err := ks.db.Raw(query, program.ID).Find(&count).Error ; err != nil {
	//      log.Errorln("error querying kolibri database for program content count")
	//      continue
	//    }
	// 	prog := program.IntoCourse(ks.BaseURL)
	// 	if err := db.Create(&prog).Error; err != nil {
	// 		log.Errorln("error creating program in db")
	// 		continue
	// 	}
	// }
	return nil
}

func (ks *KolibriService) ImportMilestonesForProgramUser(courseId, userId uint, db *gorm.DB) error {
	// sql := `SELECT id, title, description, `
	// todo
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
	//   var activities []KolibriActivity
	//   sql := `SELECT user_id, time_spent, completion_timestamp, content_id, progress, kind FROM logger_contentsummarylog WHERE channel_id = ?`
	//   if err := ks.db.Raw(sql, courseId).Find(&activities).Error; err != nil {
	//     log.Errorln("error querying kolibri database for program activities")
	//     return err
	//   }
	//   for _, activity := range activities {
	//     var user models.User
	//    // if err := db.Model(&models.ProviderUserMapping).Where("external_id = ?", activity.UserId).First(&user).Error; err != nil {
	//   log.Errorln("error finding user by external id in ImportActivityForProgram")
	//   continue
	//     }
	// 	return nil
	// }
	return nil
}
