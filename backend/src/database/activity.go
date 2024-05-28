package database

import (
	"UnlockEdv2/src/models"
	"time"

	log "github.com/sirupsen/logrus"
)

func (db *DB) CreateActivity(activity *models.Activity) error {
	// This function is calling a stored procedure in the database to calculate the delta (src/activity_proc.sql)
	return db.Conn.Exec("SELECT insert_daily_activity(?, ?, ?, ?, ?)",
		activity.UserID, activity.ProgramID, activity.Type, activity.TotalTime, activity.ExternalID).Error
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

func (db *DB) GetUserDashboardInfo(userID int) (models.UserDashboardJoin, error) {
	var recentPrograms [3]models.RecentProgram
	// first get the users 3 most recently interacted with programs
	//
	// get the users 3 most recent programs. progress: # of milestones where type = "assignment_submission" && status = "complete" || "graded" +
	// # of milestones where type = "quiz_submission" && status = "complete" || "graded"
	// where the user has an entry in the activity table
	err := db.Conn.Table("programs p").
		Select(`p.name as program_name,
        p.alt_name,
        p.thumbnail_url,
        pp.name as provider_platform_name,
        COUNT(sub_milestones.id) * 100.0 / p.total_progress_milestones as course_progress`).
		Joins(`LEFT JOIN (
    SELECT id, program_id FROM milestones
    WHERE user_id = ? AND type IN ('assignment_submission', 'quiz_submission') AND is_completed = true
    ORDER BY created_at DESC
    LIMIT 3 ) sub_milestones ON sub_milestones.program_id = p.id`, userID).
		Joins("LEFT JOIN provider_platforms pp ON p.provider_platform_id = pp.id").
		Where("p.id IN (SELECT program_id FROM activities WHERE user_id = ?)", userID).
		Group("p.id, p.name, p.alt_name, p.thumbnail_url, pp.name").
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

	err = db.Conn.Table("programs p").
		Select(`p.id as program_id,
				p.alt_name,
				p.name,
				pp.name as provider_platform_name,
				p.external_url,
				DATE(a.created_at) as date,
				a.time_delta`).
		Joins("JOIN provider_platforms pp ON p.provider_platform_id = pp.id").
		Joins("JOIN activities a ON a.program_id = p.id").
		Where("a.user_id = ? AND a.created_at >= ?", userID, time.Now().AddDate(0, 0, -7)).
		Group("p.id, a.time_delta, DATE(a.created_at), pp.name").
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
		err = db.Conn.Table("programs p").Select(`p.id as program_id, p.alt_name, p.name, pp.name as provider_platform_name, p.external_url`).
			Joins(`JOIN provider_platforms pp ON p.provider_platform_id = pp.id`).
			Joins(`LEFT JOIN milestones m on m.program_id = p.id`).Where(`m.user_id`, userID).Find(&newEnrollments).Error
		if err != nil {
			log.Fatalf("Query failed: %v", err)
		}
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
