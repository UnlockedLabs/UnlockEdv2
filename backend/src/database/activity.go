package database

import (
	"UnlockEdv2/src/models"
	"math"
	"sort"
	"time"

	log "github.com/sirupsen/logrus"
)

type DailyActivity struct {
	Date       time.Time         `json:"date"`
	TotalTime  int64             `json:"total_time"`
	Quartile   int64             `json:"quartile"`
	Activities []models.Activity `json:"activities"`
}

func (db *DB) GetDailyActivityByUserID(userID int, year int) ([]DailyActivity, error) {
	var activities []models.Activity
	var startDate time.Time
	var endDate time.Time

	// Calculate start and end dates for the past year
	if year == 0 {
		startDate = time.Now().AddDate(-1, 0, 0).Truncate(24 * time.Hour)
		endDate = time.Now().Truncate(24 * time.Hour)
	} else {
		startDate = time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
		endDate = time.Date(year+1, 1, 1, 0, 0, 0, 0, time.UTC).Add(-1 * time.Second)
	}

	if err := db.Where("user_id = ? AND created_at BETWEEN ? AND ?", userID, startDate, endDate).Find(&activities).Error; err != nil {
		return nil, newGetRecordsDBError(err, "activities")
	}

	// Combine activities based on date
	dailyActivities := make(map[time.Time]DailyActivity)
	for _, activity := range activities {
		date := activity.CreatedAt.Truncate(24 * time.Hour)
		if dailyActivity, ok := dailyActivities[date]; ok {
			dailyActivity.TotalTime += activity.TimeDelta
			dailyActivity.Activities = append(dailyActivity.Activities, activity)
			dailyActivities[date] = dailyActivity
		} else {
			dailyActivities[date] = DailyActivity{
				Date:       date,
				TotalTime:  activity.TimeDelta,
				Activities: []models.Activity{activity},
			}
		}
	}

	// Convert map to slice
	var dailyActivityList []DailyActivity
	for _, dailyActivity := range dailyActivities {
		dailyActivityList = append(dailyActivityList, dailyActivity)
	}

	// Sort daily activity list by total time
	sort.Slice(dailyActivityList, func(i, j int) bool {
		return dailyActivityList[i].TotalTime < dailyActivityList[j].TotalTime
	})

	// Calculate quartiles for each day's activities
	n := len(dailyActivityList)
	for i := range dailyActivityList {
		switch {
		case i < n/4:
			dailyActivityList[i].Quartile = 1
		case i < n/2:
			dailyActivityList[i].Quartile = 2
		case i < 3*n/4:
			dailyActivityList[i].Quartile = 3
		default:
			dailyActivityList[i].Quartile = 4
		}
	}

	// sort by date
	sort.Slice(dailyActivityList, func(i, j int) bool {
		return dailyActivityList[i].Date.Before(dailyActivityList[j].Date)
	})

	return dailyActivityList, nil
}

func (db *DB) GetActivityByCourseID(page, perPage, courseID int) (int64, []models.Activity, error) {
	var activities []models.Activity
	var count int64
	_ = db.Model(&models.Activity{}).Where("course_id = ?", courseID).Count(&count)
	if err := db.Where("course_id = ?", courseID).Offset((page - 1) * perPage).Limit(perPage).Find(&activities).Error; err != nil {
		return count, nil, newGetRecordsDBError(err, "activities")
	}
	return count, activities, nil
}

func (db *DB) DeleteActivity(activityID int) error {
	return db.Delete(&models.Activity{}, activityID).Error
}

type result struct {
	CourseID             uint
	AltName              string
	Name                 string
	ProviderPlatformName string
	ExternalURL          string
	Date                 string
	TimeDelta            int64
}

func dashboardHelper(results []result) []models.CurrentEnrollment {
	enrollmentsMap := make(map[uint]*models.CurrentEnrollment)
	for _, result := range results {
		if _, exists := enrollmentsMap[result.CourseID]; !exists {
			enrollmentsMap[result.CourseID] = &models.CurrentEnrollment{
				AltName:              result.AltName,
				Name:                 result.Name,
				ProviderPlatformName: result.ProviderPlatformName,
				ExternalURL:          result.ExternalURL,
				TotalTime:            0,
			}
		}
		enrollmentsMap[result.CourseID].TotalTime += result.TimeDelta
	}

	var enrollments []models.CurrentEnrollment
	for _, enrollment := range enrollmentsMap {
		enrollments = append(enrollments, *enrollment)
	}
	return enrollments
}

/*
RETURNS:

	type UserDashboardJoin struct {
		Enrollments    []CurrentEnrollment `json:"enrollments"`
		RecentCourses [3]RecentCourse    `json:"recent_courses"`
		WeekActivity   []RecentActivity    `json:"week_activity"`
	}

For the users dashboard. TODO:  We have to cache this so we aren't running on each visit to home
*/
func (db *DB) GetStudentDashboardInfo(userID int, facilityID uint) (models.UserDashboardJoin, error) {
	var recentCourses []models.RecentCourse
	// first get the users 3 most recently interacted with courses
	//
	// get the users 3 most recent courses. progress: # of milestones where type = "assignment_submission" && status = "complete" || "graded" +
	// # of milestones where type = "quiz_submission" && status = "complete" || "graded"
	// where the user has an entry in the activity table
	err := db.Table("courses c").Select(`c.name as course_name,
        c.alt_name,
        c.thumbnail_url,
        c.external_url,
        pp.name as provider_platform_name,
        CASE
            WHEN COUNT(o.type) > 0 THEN 100
            WHEN COUNT(c.total_progress_milestones) = 0 THEN 0
            ELSE COUNT(milestones.id) * 100.0 / c.total_progress_milestones
        END as course_progress`).
		Joins("LEFT JOIN provider_platforms pp ON c.provider_platform_id = pp.id").
		Joins("LEFT JOIN milestones ON milestones.course_id = c.id AND milestones.user_id = ?", userID).
		Joins("LEFT JOIN outcomes o ON o.course_id = c.id AND o.user_id = ?", userID).
		Where("c.id IN (SELECT course_id FROM activities WHERE user_id = ?)", userID).
		Where("o.type IS NULL").
		Group("c.id, c.name, c.alt_name, c.thumbnail_url, pp.name").
		Order("MAX(milestones.created_at) DESC").
		Limit(3).
		Find(&recentCourses).Error
	if err != nil {
		log.Errorf("Error getting recent courses: %v", err)
		recentCourses = []models.RecentCourse{}
	}

	dashboard := models.UserDashboardJoin{}
	// TOP PROGRAMS
	var topCourses []string
	err = db.Table("activities a").
		Select("c.name as course_name").
		Joins("JOIN courses c ON a.course_id = c.id").
		Joins("JOIN users u ON a.user_id = u.id").
		Where("u.facility_id = ?", facilityID).
		Group("c.id").
		Order("SUM(a.time_delta) DESC").
		Limit(6).
		Find(&topCourses).Error
	if err != nil {
		log.Errorf("Query failed: %v", err)
		return dashboard, NewDBError(err, "error getting student dashboard info")
	}

	// then get the users current enrollments
	// which is the course.alt_name, course.name, provider_platform.name as provider_platform_name (join on provider_platform_id = provider_platform.id), course.external_url,
	// and acitvity.total_activity_time for the last 7 days of activity where activity.user_id = userID and activity.course_id = course.id
	results := []result{}

	err = db.Table("courses c").
		Select(`c.id as course_id,
				c.alt_name,
				c.name,
				pp.name as provider_platform_name,
				c.external_url,
				DATE(a.created_at) as date,
				SUM(a.time_delta) as time_delta`).
		Joins("JOIN provider_platforms pp ON c.provider_platform_id = pp.id").
		Joins("JOIN activities a ON a.course_id = c.id").
		Joins("LEFT JOIN outcomes o ON o.course_id = c.id AND o.user_id = ?", userID).
		Where("a.user_id = ? AND a.created_at >= ?", userID, time.Now().AddDate(0, 0, -7)).
		Where("o.type IS NULL").
		Group("c.id, DATE(a.created_at), pp.name").
		Find(&results).Error
	if err != nil {
		log.Errorf("Query failed: %v", err)
		return dashboard, NewDBError(err, "error getting student dashboard info")
	}
	enrollments := dashboardHelper(results)
	if len(enrollments) == 0 {
		log.Println("No enrollments found")
		var newEnrollments []struct {
			CourseID             uint
			AltName              string
			Name                 string
			ProviderPlatformName string
			ExternalURL          string
		}
		err = db.Table("courses c").Select(`c.id as course_id, c.alt_name, c.name, pp.name as provider_platform_name, c.external_url`).
			Joins(`JOIN provider_platforms pp ON c.provider_platform_id = pp.id`).
			Joins(`LEFT JOIN milestones m on m.course_id = c.id`).Where(`m.user_id`, userID).Find(&newEnrollments).Error
		if err != nil {
			log.Errorf("Query failed: %v", err)
			return dashboard, NewDBError(err, "error getting student dashboard info")
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
			})
			log.Printf("enrollments: %v", enrollments)
		}
	}

	// get activity for past 7 days
	var activities []models.RecentActivity

	err = db.Table("activities a").
		Select(`DATE(a.created_at) as date, SUM(a.time_delta) as delta`).
		Where("a.user_id = ? AND a.created_at >= ?", userID, time.Now().AddDate(0, 0, -7)).
		Group("date").
		Find(&activities).Error
	if err != nil {
		log.Errorf("Query failed: %v", err)
		return dashboard, NewDBError(err, "error getting student dashboard info")
	}

	return models.UserDashboardJoin{Enrollments: enrollments, RecentCourses: recentCourses, TopCourses: topCourses, WeekActivity: activities}, err
}

func (db *DB) GetAdminDashboardInfo(facilityID uint) (models.AdminDashboardJoin, error) {
	var dashboard models.AdminDashboardJoin

	// facility name
	err := db.Table("facilities f").
		Select("f.name as facility_name").
		Where("f.id = ?", facilityID).
		Find(&dashboard.FacilityName).Error
	if err != nil {
		return dashboard, NewDBError(err, "error getting admin dashboard info")
	}

	// Monthly Activity
	if db.Dialector.Name() == "sqlite" {
		err = db.Table("activities a").
			Select("STRFTIME('%Y-%m-%d', a.created_at) as date, ROUND(SUM(a.time_delta) / 3600.0,2) as delta").
			Joins("JOIN users u ON a.user_id = u.id").
			Where("u.facility_id = ? AND a.created_at >= ?", facilityID, time.Now().AddDate(0, -1, 0)).
			Group("STRFTIME('%Y-%m-%d', 'YYYY-MM-DD')").
			Order("date ").
			Find(&dashboard.MonthlyActivity).Error

	} else {
		err = db.Table("activities a").
			Select("TO_CHAR(a.created_at, 'YYYY-MM-DD') as date, ROUND(SUM(a.time_delta) / 3600.0,2) as delta").
			Joins("JOIN users u ON a.user_id = u.id").
			Where("u.facility_id = ? AND a.created_at >= ?", facilityID, time.Now().AddDate(0, -1, 0)).
			Group("TO_CHAR(a.created_at, 'YYYY-MM-DD')").
			Order("date ").
			Find(&dashboard.MonthlyActivity).Error
	}
	if err != nil {
		return dashboard, NewDBError(err, "error getting admin dashboard info")
	}

	// Weekly Active Users, Average Daily Activity, Total Weekly Activity
	var result struct {
		WeeklyActiveUsers   int64
		AvgDailyActivity    float64
		TotalWeeklyActivity int64
	}

	err = db.Table("activities a").
		Select(`
			COUNT(DISTINCT a.user_id) as weekly_active_users, 
			AVG(a.time_delta) as avg_daily_activity,
			SUM(a.time_delta) as total_weekly_activity`).
		Joins("JOIN users u ON a.user_id = u.id").
		Where("u.facility_id = ? AND a.created_at >= ?", facilityID, time.Now().AddDate(0, 0, -7)).
		Find(&result).Error
	if err != nil {
		log.Errorf("Query failed: %v", err)
		return dashboard, NewDBError(err, "error getting admin dashboard info")
	}

	dashboard.WeeklyActiveUsers = int64(math.Abs(float64(result.WeeklyActiveUsers)))
	dashboard.AvgDailyActivity = int64(math.Abs(result.AvgDailyActivity))
	dashboard.TotalWeeklyActivity = int64(math.Abs(float64(result.TotalWeeklyActivity)))

	// Course Milestones
	err = db.Table("courses c").
		Select("c.name as name, COUNT(m.id) as milestones").
		Joins("INNER JOIN milestones m ON m.course_id = c.id AND m.created_at >= ?", time.Now().AddDate(0, 0, -7)).
		Joins("INNER JOIN users u ON m.user_id = u.id AND u.facility_id = ?", facilityID).
		Group("c.name").
		Order("milestones DESC").
		Limit(5).
		Find(&dashboard.CourseMilestones).Error
	if err != nil {
		return dashboard, NewDBError(err, "error getting admin dashboard info")
	}

	// Top 5 Courses by Hours Engaged
	err = db.Table("activities a").
		Select("c.name as course_name, c.alt_name as alt_name, SUM(a.time_delta) / 3600.0 as hours_engaged").
		Joins("JOIN courses c ON a.course_id = c.id").
		Joins("JOIN users u ON a.user_id = u.id").
		Where("u.facility_id = ? AND a.created_at >= ?", facilityID, time.Now().AddDate(0, 0, -7)).
		Group("c.id").
		Order("hours_engaged DESC").
		Limit(5).
		Find(&dashboard.TopCourseActivity).Error
	if err != nil {
		return dashboard, NewDBError(err, "error getting admin dashboard info")
	}

	return dashboard, nil
}
