package database

import (
	"UnlockEdv2/src/models"
	"math/rand"
	"time"

	"github.com/google/uuid"
)

const seededActivity = "SEEDED_ACTIVITY"

func (db *DB) RunOrResetDemoSeed(facilityId uint) error {
	// seeding data for demo will only seed user activity/milestones/open-content activity for existing users
	activity := models.Activity{}
	if err := db.Model(&models.Activity{}).Where("external_id = ?", seededActivity).Order("created_at DESC").First(&activity).Error; err != nil {
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
	users := []models.User{}
	if err := db.Find(&users, "facility_id = ?", facilityId).Error; err != nil {
		return newGetRecordsDBError(err, "users")
	}

	courses := []models.Course{}
	if err := db.Find(&courses).Error; err != nil {
		return newGetRecordsDBError(err, "courses")
	}

	libraries := []models.Library{}
	if err := db.Model(&models.Library{}).Limit(40).Find(&libraries).Error; err != nil {
		return newGetRecordsDBError(err, "libraries")
	}

	contentUrls := []models.OpenContentUrl{}
	if err := db.Model(&models.OpenContentUrl{}).Find(&contentUrls).Error; err != nil {
		return newGetRecordsDBError(err, "open_content_urls")
	}
	if len(contentUrls) == 0 {
		newContentUrls := []models.OpenContentUrl{
			{ContentURL: "/"}, {ContentURL: "/math"}, {ContentURL: "/science"}, {ContentURL: "/history"},
		}
		if err := db.CreateInBatches(&newContentUrls, 4).Error; err != nil {
			return newCreateDBError(err, "open_content_urls")
		}
		contentUrls = newContentUrls
	}

	sixMonthsAgo := time.Now().AddDate(0, -6, 0)
	for _, user := range users {
		enrolledCourses := randomSubset(courses, len(courses)/2)
		for _, course := range enrolledCourses {
			startDate := course.StartDt
			if startDate == nil {
				startDate = &sixMonthsAgo
			}

			daysSinceStart := int(time.Since(*startDate).Hours() / 24)
			milestonesPerUser := 0
			totalCourseTime := int64(0)

			for day := 0; day < daysSinceStart; day++ {
				randTime := rand.Int63n(50)
				externalID := uuid.NewString()
				if day == 0 {
					externalID = "SEEDED_ACTIVITY"
				}

				createdAt := time.Now().AddDate(0, 0, -day)
				if err := db.Exec(
					"INSERT INTO activities (user_id, course_id, total_time, time_delta, type, created_at, external_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
					user.ID, course.ID, totalCourseTime, randTime, models.ContentInteraction, createdAt, externalID,
				).Error; err != nil {
					continue
				}

				totalCourseTime += randTime

				if day%8 == 0 && uint(milestonesPerUser) < course.TotalProgressMilestones {
					milestone := models.Milestone{
						UserID: user.ID, CourseID: course.ID, ExternalID: uuid.NewString(),
						Type: models.AssignmentSubmission, IsCompleted: rand.Intn(2) == 0,
					}
					if err := db.Create(&milestone).Error; err != nil {
						continue
					}
					milestonesPerUser++
				}
			}
		}

		for i := 0; i < 180; i++ {
			for _, library := range libraries {
				if i%(rand.Intn(8)+1) == 0 {
					openContentActivity := models.OpenContentActivity{
						UserID:                user.ID,
						RequestTS:             sixMonthsAgo.AddDate(0, 0, i).Add(time.Duration(i) * time.Minute),
						ContentID:             library.ID,
						OpenContentProviderID: library.OpenContentProviderID,
						OpenContentUrlID:      uint(rand.Intn(len(contentUrls)) + 1),
						FacilityID:            facilityId,
					}
					if err := db.Create(&openContentActivity).Error; err != nil {
						continue
					}
				}
			}
		}
	}

	return nil
}

func randomSubset[T any](items []T, size int) []T {
	if size >= len(items) {
		return items
	}
	shuffled := make([]T, len(items))
	copy(shuffled, items)
	rand.Shuffle(len(shuffled), func(i, j int) { shuffled[i], shuffled[j] = shuffled[j], shuffled[i] })
	return shuffled[:size]
}
