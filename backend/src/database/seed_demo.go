package database

import (
	"UnlockEdv2/src/models"
	"math/rand"
	"time"

	"github.com/google/uuid"
)

func (db *DB) RunOrResetDemoSeed(facilityId uint) error {
	// seeding data for demo will only seed user activity/milestones/open-content activity for existing users
	activity := models.Activity{}
	if err := db.Model(&models.Activity{}).Where("external_id = 'SEEDED_ACTIVITY'").Order("created_at DESC").First(&activity).Error; err != nil {
		return db.RunDemoSeed(facilityId)
	}
	if err := db.Raw("DELETE from activities WHERE created_at > ?", activity.CreatedAt).Error; err != nil {
		return newDeleteDBError(err, "activities")
	}
	if err := db.Raw("DELETE from open_content_activities WHERE request_ts > ?", activity.CreatedAt).Error; err != nil {
		return newDeleteDBError(err, "open_content_activities")
	}
	if err := db.Raw("DELETE from milestones WHERE created_at > ?", activity.CreatedAt).Error; err != nil {
		return newDeleteDBError(err, "milestones")
	}
	return db.RunDemoSeed(facilityId)
}

func (db *DB) RunDemoSeed(facilityId uint) error {
	users := make([]models.User, 0, 20)
	if err := db.Find(&users, "facility_id = ?", facilityId).Error; err != nil {
		return newGetRecordsDBError(err, "users")
	}
	courses := make([]models.Course, 0, 10)
	if err := db.Find(&courses).Error; err != nil {
		return newGetRecordsDBError(err, "courses")
	}
	libraries := make([]models.Library, 0, 40)
	if err := db.Model(&models.Library{}).Limit(40).Find(&libraries).Error; err != nil {
		return newGetRecordsDBError(err, "libraries")
	}
	contentUrls := make([]models.OpenContentUrl, 0, 10)
	if err := db.Model(&models.OpenContentUrl{}).Find(&contentUrls).Error; err != nil {
		return newGetRecordsDBError(err, "open_content_urls")
	}
	if len(contentUrls) == 0 {
		newContentUrls := []models.OpenContentUrl{{ContentURL: "/"}, {ContentURL: "/math"}, {ContentURL: "/science"}, {ContentURL: "/history"}}
		if err := db.CreateInBatches(&newContentUrls, 4).Error; err != nil {
			return newCreateDBError(err, "open_content_urls")
		}
	}
	sixMonthsAgo := time.Now().AddDate(0, 0, -180)
	for _, user := range users {
		// seed user activity for six months for each user
		mpu := 0 // milestones per user
		for _, course := range courses {
			mpu = 0
			courseTotalTime := int64(0)
			for i := 0; i < 180; i++ {
				randTime := rand.Int63n(500)
				externalID := ""
				if i == 0 {
					externalID = "SEEDED_ACTIVITY"
				} else {
					externalID = uuid.NewString()
				}
				if err := db.Exec("SELECT insert_daily_activity(?, ?, ?, ?, ?)", user.ID, course.ID, models.ContentInteraction, courseTotalTime, externalID).Error; err != nil {
					continue
				}
				courseTotalTime += randTime
				if i%(rand.Intn(30)+1) == 0 {
					if course.TotalProgressMilestones >= uint(mpu) {
						continue
					}
					milestone := models.Milestone{UserID: user.ID, CourseID: course.ID, ExternalID: uuid.NewString(), Type: models.AssignmentSubmission, IsCompleted: false}
					if err := db.Create(&milestone).Error; err != nil {
						continue
					}
					mpu++
				}
			}
		}
		for i := 0; i < 180; i++ {
			for _, library := range libraries {
				if i%(rand.Intn(8)+1) == 0 {
					activity := models.OpenContentActivity{UserID: user.ID, RequestTS: sixMonthsAgo.AddDate(0, 0, i).Add((time.Duration(i)) * time.Minute), ContentID: library.ID, OpenContentProviderID: library.OpenContentProviderID, OpenContentUrlID: uint(rand.Intn(4) + 1), FacilityID: facilityId}
					if err := db.Create(&activity).Error; err != nil {
						continue
					}
				}
			}
		}
	}
	return nil
}
