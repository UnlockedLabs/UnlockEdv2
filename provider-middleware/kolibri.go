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
	dsn := fmt.Sprintf("host=%s user=kolibri password=%s dbname=kolibri port=%s sslmode=prefer TimeZone=UTC", host, password, port)
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
	query := `SELECT full_name, username, id FROM kolibriauth_facilityuser WHERE facility_id = ?`
	var users []map[string]string
	if err := ks.db.Raw(query, ks.AccountID).Scan(&users).Error; err != nil {
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
func (ks *KolibriService) ImportCourses(db *gorm.DB) error {
	log.Println("Importing courses from Kolibri")
	var courses []map[string]interface{}
	sql := `SELECT id, author, name, description, thumbnail, total_resource_count, public, root_id FROM content_channelmetadata`
	if err := ks.db.Raw(sql).Scan(&courses).Error; err != nil {
		log.Errorln("error querying kolibri database for courses")
		return err
	}
	log.Println(courses)
	for _, course := range courses {
		id := course["id"].(string)
		if db.Where("provider_platform_id = ? AND external_id = ?", ks.ProviderPlatformID, id).First(&models.Course{}).Error == nil {
			continue
		}
		prog := ks.IntoCourse(course)
		if err := db.Create(&prog).Error; err != nil {
			log.Errorln("error creating course in db")
			continue
		}
	}
	return nil
}

func (ks *KolibriService) ImportMilestones(coursePair map[string]interface{}, mapping []map[string]interface{}, db *gorm.DB, lastRun time.Time) error {
	return nil
}

//  courseId := coursePair["external_course_id"].(string)
//
// 	for user := range mapping {
// 	sql := `WITH resource_progress AS (
//     SELECT
//         channel_id,
//         content_id,
//         CASE
//             WHEN SUM(progress) > 1.0 THEN 1.0
//             ELSE SUM(progress)
//         END AS total_progress
//     FROM
//         logger_contentsessionlog
// 	WHERE user_id = ? AND channel_id = ?
//     GROUP BY
//         channel_id, content_id
// ),
// channel_progress AS (
//     SELECT
//         rp.channel_id,
//         SUM(CASE WHEN rp.total_progress >= 1 THEN 1 ELSE 0 END) AS finished,
//         SUM(CASE WHEN rp.total_progress < 1 THEN 1 ELSE 0 END) AS in_progress,
//         SUM(rp.total_progress) AS total_progress_sum
//     FROM
//         resource_progress AS rp
//     GROUP BY
//         rp.channel_id
// )
// SELECT
//     channel.name AS channel_name,
//     channel.total_resource_count,
//     cp.finished,
//     cp.in_progress,
//     cp.channel_id,
//     (channel.total_resource_count - (cp.finished + cp.in_progress)) AS not_started,
//     cp.total_progress_sum,
//     (cp.total_progress_sum / channel.total_resource_count) * 100 AS percent_complete
// FROM
//     content_channelmetadata AS channel
// JOIN
//     channel_progress AS cp
// ON
//     channel.id = cp.channel_id
// WHERE
//     cp.channel_id = ? AND cp.finished > 0 OR cp.in_progress > 0
// ORDER BY
//     channel.name;`
//
// 		data := make(map[string]interface{})
// 	if err := ks.db.Raw(sql, user["external_user_id"].(string), courseId, courseId).Scan(&data).Error; err != nil {
// 		return nil
// 	}
// 		existing := models.Milestone{}
// 		if err := db.Model(&models.Milestone{}).Where("course_id = ? AND user_id = ?", coursePair["course_id"], user["user_id"]).First(&existing).Error; err != nil {
//
//
//}

type KolibriActivity struct {
	ID                  string `json:"id"`
	UserId              string `json:"user_id"`
	TimeSpent           string `json:"time_spent"`
	CompletionTimestamp string `json:"completion_timestamp"`
	ContentId           string `json:"content_id"`
	Progress            string `json:"progress"`
	Kind                string `json:"kind"`
}

func (ks *KolibriService) ImportActivityForCourse(courseIdPair map[string]interface{}, db *gorm.DB) error {
	courseId := int(courseIdPair["course_id"].(float64))
	externalId := courseIdPair["external_course_id"].(string)
	sql := `SELECT id, user_id, time_spent, completion_timestamp, content_id, progress, kind FROM logger_contentsummarylog WHERE channel_id = ?`
	var activities []KolibriActivity
	if err := ks.db.Raw(sql, externalId).Find(&activities).Error; err != nil {
		log.Errorln("error querying kolibri database for course activities")
		return err
	}
	for _, activity := range activities {
		var user_id uint
		if err := db.Model(&models.ProviderUserMapping{}).Select("user_id").First(&user_id, "external_user_id = ?", activity.UserId).Error; err != nil {
			log.Errorln("error finding user by external id in ImportActivityForCourse")
			continue
		}
		kinds := map[string]models.ActivityType{
			"video":    models.ContentInteraction,
			"exercise": models.CourseInteraction,
			"html5":    models.ContentInteraction,
			"h5p":      models.ContentInteraction,
			"topic":    models.CourseInteraction,
		}
		time, err := strconv.ParseFloat(activity.TimeSpent, 64)
		if err != nil {
			log.Errorln("error parsing time spent in ImportActivityForCourse")
			continue
		}
		kind, ok := kinds[activity.Kind]
		if !ok {
			kind = models.ContentInteraction
		}
		if err := db.Exec("SELECT insert_daily_activity(?, ?, ?, ?, ?)", user_id, courseId, kind, time, activity.ID).Error; err != nil {
			log.WithFields(log.Fields{"userId": user_id, "course_id": courseId, "error": err}).Error("Failed to create activity")
			continue
		}
	}
	return nil
}
