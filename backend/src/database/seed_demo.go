package database

import (
	"UnlockEdv2/src/models"
	"math/rand"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	log "github.com/sirupsen/logrus"
)

const seededActivity = "SEEDED_ACTIVITY"

func (db *DB) RunOrResetDemoSeed(facilityId uint) error {
	// seeding data for demo will only seed user activity/milestones/open-content activity for existing users
	activity := models.Activity{}
	if err := db.Model(&models.Activity{}).Where("external_id = ?", seededActivity).Order("created_at DESC").First(&activity).Error; err == nil {
		if err := db.Exec("DELETE from user_course_activity_totals where date(last_ts) >= date(?)", activity.CreatedAt).Error; err != nil {
			return newDeleteDBError(err, "user_course_activity_totals")
		}
		if err := db.Exec("DELETE from activities where date(created_at) >= date(?)", activity.CreatedAt).Error; err != nil {
			return newDeleteDBError(err, "activities")
		}
		if err := db.Exec("DELETE from milestones where date(created_at) >= date(?)", activity.CreatedAt).Error; err != nil {
			return newDeleteDBError(err, "milestones")
		}
		if err := db.Exec("DELETE from outcomes where date(created_at) >= date(?)", activity.CreatedAt).Error; err != nil {
			return newDeleteDBError(err, "outcomes")
		}
		if err := db.Exec("DELETE from open_content_activities where date(request_ts) >= date(?)", activity.CreatedAt).Error; err != nil {
			return newDeleteDBError(err, "open_content_activities")
		}
	}
	return db.RunDemoSeed(facilityId)
}

func (db *DB) RunDemoSeed(facilityId uint) error {
	users := []models.User{}
	if err := db.Model(&models.User{}).Preload("Enrollments").Find(&users, "facility_id = ?", facilityId).Error; err != nil {
		return newGetRecordsDBError(err, "users")
	}

	//just update courses total progress where they are equal to 0
	if err := db.Model(&models.Course{}).Where("total_progress_milestones = 0").Update("total_progress_milestones", 40).Error; err != nil {
		log.Infof("no courses needed to be updated") //just logging the message
	}

	courses := []models.Course{}
	if err := db.Preload("ProviderPlatform").Find(&courses).Error; err != nil {
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
	outcomes := []string{"college_credit", "grade", "certificate", "pathway_completion"}
	completedNumCount := 0
	sixMonthsAgo := time.Now().AddDate(0, -6, 0)
	for _, user := range users {
		enrolledCourses := randomSubset(courses, len(courses)/2)
		for _, course := range enrolledCourses {
			startDate := course.StartDt
			if startDate == nil {
				startDate = &sixMonthsAgo
			}
			if !slices.ContainsFunc(user.Enrollments, func(e models.UserEnrollment) bool {
				return e.CourseID == course.ID
			}) {
				if err := db.Exec("INSERT INTO user_enrollments (user_id, course_id, external_id, created_at) VALUES (?, ?, ?, ?)",
					user.ID, course.ID, uuid.NewString(), startDate).Error; err != nil {
					logrus.Println(err)
				}
			}
			daysSinceStart := int(time.Since(*startDate).Hours() / 24)
			backThen := time.Now().AddDate(0, 0, -daysSinceStart)
			milestonesPerUser := 0
			totalCourseTime := int64(0)

			for day := 0; day < daysSinceStart; day++ {
				randTime := rand.Int63n(5000)
				externalID := uuid.NewString()
				if day == 0 {
					externalID = "SEEDED_ACTIVITY"
				}
				createdAt := backThen.AddDate(0, 0, day)
				if course.ProviderPlatform == nil {
					continue
				}
				sqlStr := ""
				var timeToEnter int64
				switch course.ProviderPlatform.Type {
				case models.Kolibri:
					sqlStr = "CALL insert_daily_activity_kolibri(?, ?, ?, ?, ?, ?)"
					timeToEnter = randTime
				case models.CanvasCloud, models.CanvasOSS:
					sqlStr = "CALL insert_daily_activity_canvas(?, ?, ?, ?, ?, ?)"
					timeToEnter = totalCourseTime
				default:
					continue
				}
				if err := db.Exec(sqlStr, user.ID, course.ID, models.ContentInteraction, timeToEnter, externalID, createdAt).
					Error; err != nil {
					continue
				}
				totalCourseTime += randTime

				if day%8 == 0 && uint(milestonesPerUser) < course.TotalProgressMilestones {
					milestone := models.Milestone{
						UserID: user.ID, CourseID: course.ID, ExternalID: uuid.NewString(),
						Type: models.AssignmentSubmission, IsCompleted: rand.Intn(2) == 0,
					}
					milestone.CreatedAt = createdAt
					if err := db.Create(&milestone).Error; err != nil {
						continue
					}
					milestonesPerUser++
					if uint(milestonesPerUser) == course.TotalProgressMilestones && completedNumCount != 3 {
						//add outcome here
						outcome := models.Outcome{
							UserID:   user.ID,
							CourseID: course.ID,
							Type:     models.OutcomeType(outcomes[rand.Intn(len(outcomes))]),
						}
						outcome.CreatedAt = createdAt
						if err := db.Create(&outcome).Error; err != nil {
							continue
						}
						completedNumCount++
					}
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
