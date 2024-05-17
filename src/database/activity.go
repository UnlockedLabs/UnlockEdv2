package database

import (
	"Go-Prototype/src/models"
	"fmt"
	"time"

	log "github.com/sirupsen/logrus"
)

func (db *DB) CreateActivity(activity *models.Activity) error {
	return db.Conn.Create(activity).Error
}

func (db *DB) GetActivityByUserID(page, perPage, userID int) (int64, []models.Activity, error) {
	var activities []models.Activity
	var count int64
	_ = db.Conn.Model(&models.Activity{}).Where("user_id = ?", userID).Count(&count)
	return count, activities, db.Conn.Where("user_id = ?", userID).Offset((page - 1) * perPage).Limit(perPage).Find(&activities).Error
}

func (db *DB) GetActivityByProgramID(page, perPage, programID int) (int64, []models.Activity, error) {
	var activities []models.Activity
	var count int64
	_ = db.Conn.Model(&models.Activity{}).Where("program_id = ?", programID).Count(&count)
	return count, activities, db.Conn.Where("program_id = ?", programID).Offset((page - 1) * perPage).Limit(perPage).Find(&activities).Error
}

func (db *DB) DeleteActivity(activityID int) error {
	return db.Conn.Delete(&models.Activity{}, activityID).Error
}

/*
type RecentProgram struct {
	Name                 string `json:"program_name"`
	Progress             string `json:"course_progress"`
	AltName              string `json:"alt_name"`
	ThumbnailURL         string `json:"thumbnail_url"`
	ProviderPlatformName string `json:"provider_platform_name"`
	ExternalURL          string `json:"external_url"`
}
*
type CurrentEnrollment struct {
	AltName              string            `json:"alt_name"`
	Name                 string            `json:"name"`
	ProviderPlatformName string            `json:"provider_platform_name"`
	ExternalURL          string            `json:"external_url"`
	TotalActivityTime    [7]RecentActivity `json:"total_activity_time"`
}
*/

func (db *DB) GetUserDashboardInfo(userID int) (models.UserDashboardJoin, error) {
	var recentPrograms [3]models.RecentProgram
	// first get the users 3 most recently interacted with programs
	//
	// get the users 3 most recent programs. progress: # of milestones where type = "assignment_submission" && status = "complete" || "graded" +
	// # of milestones where type = "quiz_submission" && status = "complete" || "graded"
	err := db.Conn.Table("programs").
		Select(`programs.name as program_name,
        programs.alt_name,
        programs.thumbnail_url,
        provider_platforms.name as provider_platform_name,
        COUNT(sub_milestones.id) * 100.0 / programs.total_progress_milestones as progress`).
		Joins(fmt.Sprintf(`
        JOIN (
            SELECT id, program_id FROM (
                SELECT id, program_id, ROW_NUMBER() OVER (PARTITION BY program_id ORDER BY created_at DESC) as rn
                FROM milestones
                WHERE user_id = %d AND type IN ('assignment_submission', 'quiz_submission') AND is_completed = true
            ) tmp WHERE rn <= 3
        ) sub_milestones ON sub_milestones.program_id = programs.id`, userID)).
		Joins("JOIN provider_platforms ON programs.provider_platform_id = provider_platforms.id").
		Group("programs.id, programs.name, programs.alt_name, programs.thumbnail_url, provider_platforms.name").
		Find(&recentPrograms).Error
	if err != nil {
		log.Errorf("Error getting recent programs: %v", err)
		recentPrograms = [3]models.RecentProgram{}
	}
	// then get the users current enrollments
	// which is the program.alt_name, program.name, provider_platform.name as provider_platform_name (join on provider_platform_id = provider_platform.id), program.external_url,
	// and acitvity.total_activity_time for the last 7 days of activity where activity.user_id = userID and activity.program_id = program.id
	var results []struct {
		ProgramID            uint
		AltName              string
		Name                 string
		ProviderPlatformName string
		ExternalURL          string
		Date                 string
		TimeDelta            uint
	}

	err = db.Conn.Table("programs").
		Select(`programs.id as program_id,
				programs.alt_name,
				programs.name,
				provider_platforms.name as provider_platform_name,
				programs.external_url,
				DATE(activities.created_at) as date,
				activities.time_delta`).
		Joins("JOIN provider_platforms ON programs.provider_platform_id = provider_platforms.id").
		Joins("JOIN activities ON activities.program_id = programs.id").
		Where("activities.user_id = ? AND activities.created_at >= ?", userID, time.Now().AddDate(0, 0, -7)).
		Group("programs.id, activities.time_delta, DATE(activities.created_at), provider_platforms.name").
		Find(&results).Error
	if err != nil {
		log.Fatalf("Query failed: %v", err)
	}
	enrollmentsMap := make(map[uint]*models.CurrentEnrollment)
	for _, result := range results {
		if _, exists := enrollmentsMap[result.ProgramID]; !exists {
			enrollmentsMap[result.ProgramID] = &models.CurrentEnrollment{
				AltName:              result.AltName,
				Name:                 result.Name,
				ProviderPlatformName: result.ProviderPlatformName,
				ExternalURL:          result.ExternalURL,
				TotalActivityTime:    []models.RecentActivity{},
			}
		}
		date, _ := time.Parse("2006-01-02", result.Date)
		index := int(time.Since(date).Hours() / 24)
		if index >= 0 && index < 7 {
			enrollmentsMap[result.ProgramID].TotalActivityTime[index] = models.RecentActivity{
				Date:  result.Date,
				Delta: result.TimeDelta,
			}
		}
	}
	var enrollments []models.CurrentEnrollment
	for _, enrollment := range enrollmentsMap {
		enrollments = append(enrollments, *enrollment)
	}
	if len(enrollments) == 0 {
		log.Println("No enrollments found")
		var newEnrollments []struct {
			ProgramID            uint
			AltName              string
			Name                 string
			ProviderPlatformName string
			ExternalURL          string
		}
		err = db.Conn.Table("programs").Select(`programs.id as program_id, programs.alt_name, programs.name, provider_platforms.name as provider_platform_name, programs.external_url`).
			Joins(`JOIN provider_platforms ON programs.provider_platform_id = provider_platforms.id`).
			Joins(`LEFT JOIN milestones on milestones.program_id = programs.id`).Where(`milestones.user_id`, userID).Find(&newEnrollments).Error
		if err != nil {
			log.Fatalf("Query failed: %v", err)
		}
		log.Printf("newEnrollments: %v", newEnrollments)
		for idx, enrollment := range newEnrollments {
			if idx == 7 {
				break
			}
			enrollments = append(enrollments, models.CurrentEnrollment{
				AltName:              enrollment.AltName,
				Name:                 enrollment.Name,
				ProviderPlatformName: enrollment.ProviderPlatformName,
				ExternalURL:          enrollment.ExternalURL,
				TotalActivityTime:    []models.RecentActivity{},
			})
			log.Printf("enrollments: %v", enrollments)
		}
	}
	return models.UserDashboardJoin{Enrollments: enrollments, RecentPrograms: recentPrograms}, err
}
