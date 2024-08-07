package database

import (
	"UnlockEdv2/src/models"
	"sort"
	"time"

	log "github.com/sirupsen/logrus"
)

func (db *DB) CreateActivity(activity *models.Activity) error {
	// This function is calling a stored procedure in the database to calculate the delta (src/activity_proc.sql)
	return db.Conn.Exec("SELECT insert_daily_activity(?, ?, ?, ?, ?)",
		activity.UserID, activity.ProgramID, activity.Type, activity.TotalTime, activity.ExternalID).Error
}

type DailyActivity struct {
	Date       time.Time         `json:"date"`
	TotalTime  uint              `json:"total_time"`
	Quartile   uint              `json:"quartile"`
	Activities []models.Activity `json:"activities"`
}

func (db *DB) GetActivityByUserID(userID uint, year int) ([]DailyActivity, error) {
	var dailyActivities []DailyActivity
	query := `WITH activity_data AS (
		SELECT
			user_id,
			DATE_TRUNC('day', created_at) AS activity_date,
			SUM(time_delta) AS total_time
		FROM
			activities
		WHERE
			user_id = $1 AND
			created_at BETWEEN
			CASE
				WHEN $2 = 0 THEN DATE_TRUNC('day', NOW() - INTERVAL '1 year')
				ELSE DATE_TRUNC('day', MAKE_DATE($3, 1, 1))
			END
			AND
			CASE
				WHEN $2 = 0 THEN DATE_TRUNC('day', NOW())
				ELSE DATE_TRUNC('day', MAKE_DATE($3, 1, 1) + INTERVAL '1 year' - INTERVAL '1 second')
			END
		GROUP BY
			user_id, activity_date
	),
	ranked_activities AS (
		SELECT
			activity_date,
			total_time,
			NTILE(4) OVER (ORDER BY total_time) AS quartile
		FROM
			activity_data
	)
	SELECT
		activity_date AS date,
		total_time,
		quartile
	FROM
		ranked_activities
	ORDER BY
		activity_date;`
	rows, err := db.Conn.Raw(query, userID, year, year).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var dailyActivity DailyActivity
		if err := rows.Scan(&dailyActivity.Date, &dailyActivity.TotalTime, &dailyActivity.Quartile); err != nil {
			return nil, err
		}
		dailyActivities = append(dailyActivities, dailyActivity)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Fetch all activities for the given user and year
	var activities []models.Activity
	if err = db.Conn.Table("activities").Select("*").Where(`user_id = ? AND created_at BETWEEN
			CASE
				WHEN ? = 0 THEN DATE_TRUNC('day', NOW() - INTERVAL '1 year')
				ELSE DATE_TRUNC('day', MAKE_DATE(?, 1, 1))
			END
			AND
			CASE
				WHEN $2 = 0 THEN DATE_TRUNC('day', NOW())
				ELSE DATE_TRUNC('day', MAKE_DATE(?, 1, 1) + INTERVAL '1 year' - INTERVAL '1 second')
			END
	`, userID, year, year, year).Find(&activities).Error; err != nil {
		return nil, err
	}

	for i := range dailyActivities {
		date := dailyActivities[i].Date
		dayStart := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
		dayEnd := dayStart.Add(24 * time.Hour)

		for _, activity := range activities {
			activityDate := activity.CreatedAt
			if activityDate.After(dayStart) && activityDate.Before(dayEnd) {
				dailyActivities[i].Activities = append(dailyActivities[i].Activities, activity)
			}
		}
	}

	// Sort daily activity list by date
	sort.Slice(dailyActivities, func(i, j int) bool {
		return dailyActivities[i].Date.Before(dailyActivities[j].Date)
	})

	return dailyActivities, nil
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

	if err := db.Conn.Where("user_id = ? AND created_at BETWEEN ? AND ?", userID, startDate, endDate).Find(&activities).Error; err != nil {
		return nil, err
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

func (db *DB) GetActivityByProgramID(page, perPage, programID int) (int64, []models.Activity, error) {
	var activities []models.Activity
	var count int64
	_ = db.Conn.Model(&models.Activity{}).Where("program_id = ?", programID).Count(&count)
	return count, activities, db.Conn.Where("program_id = ?", programID).Offset((page - 1) * perPage).Limit(perPage).Find(&activities).Error
}

func (db *DB) DeleteActivity(activityID int) error {
	return db.Conn.Delete(&models.Activity{}, activityID).Error
}

type result struct {
	ProgramID            uint
	AltName              string
	Name                 string
	ProviderPlatformName string
	ExternalURL          string
	Date                 string
	TimeDelta            uint
}

func dashboardHelper(results []result) []models.CurrentEnrollment {
	enrollmentsMap := make(map[uint]*models.CurrentEnrollment)
	for _, result := range results {
		if _, exists := enrollmentsMap[result.ProgramID]; !exists {
			enrollmentsMap[result.ProgramID] = &models.CurrentEnrollment{
				AltName:              result.AltName,
				Name:                 result.Name,
				ProviderPlatformName: result.ProviderPlatformName,
				ExternalURL:          result.ExternalURL,
				TotalTime:            0,
			}
		}
		enrollmentsMap[result.ProgramID].TotalTime += result.TimeDelta
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
		RecentPrograms [3]RecentProgram    `json:"recent_programs"`
		WeekActivity   []RecentActivity    `json:"week_activity"`
	}

For the users dashboard. TODO:  We have to cache this so we aren't running on each visit to home
*/
func (db *DB) GetStudentDashboardInfo(userID int, facilityID uint) (models.UserDashboardJoin, error) {
	var recentPrograms []models.RecentProgram
	// first get the users 3 most recently interacted with programs
	//
	// get the users 3 most recent programs. progress: # of milestones where type = "assignment_submission" && status = "complete" || "graded" +
	// # of milestones where type = "quiz_submission" && status = "complete" || "graded"
	// where the user has an entry in the activity table
	err := db.Conn.Table("programs p").
		Select(`p.name as program_name,
        p.alt_name,
        p.thumbnail_url,
        p.external_url,
        pp.name as provider_platform_name,
        CASE WHEN COUNT(o.type) > 0 THEN 100
        CASE WHEN COUNT(milestones.id) = 0 THEN 0
        ELSE COUNT(milestones.id) * 100.0 / p.total_progress_milestones END as course_progress`).
		Joins("LEFT JOIN provider_platforms pp ON p.provider_platform_id = pp.id").
		Joins("LEFT JOIN milestones ON milestones.program_id = p.id AND milestones.user_id = ?", userID).
		Joins("LEFT JOIN outcomes o ON o.program_id = p.id AND o.user_id = ?", userID).
		Where("p.id IN (SELECT program_id FROM activities WHERE user_id = ?)", userID).
		Where("o.type IS NULL").
		Group("p.id, p.name, p.alt_name, p.thumbnail_url, pp.name").
		Order("MAX(milestones.created_at) DESC").
		Limit(3).
		Find(&recentPrograms).Error
	if err != nil {
		log.Errorf("Error getting recent programs: %v", err)
		recentPrograms = []models.RecentProgram{}
	}

	// TOP PROGRAMS
	var topPrograms []string
	err = db.Conn.Table("activities a").
		Select("p.name as program_name").
		Joins("JOIN programs p ON a.program_id = p.id").
		Joins("JOIN users u ON a.user_id = u.id").
		Where("u.facility_id = ?", facilityID).
		Group("p.id").
		Order("SUM(a.time_delta) DESC").
		Limit(6).
		Find(&topPrograms).Error
	if err != nil {
		log.Fatalf("Query failed: %v", err)
	}

	// then get the users current enrollments
	// which is the program.alt_name, program.name, provider_platform.name as provider_platform_name (join on provider_platform_id = provider_platform.id), program.external_url,
	// and acitvity.total_activity_time for the last 7 days of activity where activity.user_id = userID and activity.program_id = program.id
	results := []result{}

	err = db.Conn.Table("programs p").
		Select(`p.id as program_id,
				p.alt_name,
				p.name,
				pp.name as provider_platform_name,
				p.external_url,
				DATE(a.created_at) as date,
				SUM(a.time_delta) as time_delta`).
		Joins("JOIN provider_platforms pp ON p.provider_platform_id = pp.id").
		Joins("JOIN activities a ON a.program_id = p.id").
		Joins("LEFT JOIN outcomes o ON o.program_id = p.id AND o.user_id = ?", userID).
		Where("a.user_id = ? AND a.created_at >= ?", userID, time.Now().AddDate(0, 0, -7)).
		Where("o.type IS NULL").
		Group("p.id, DATE(a.created_at), pp.name").
		Find(&results).Error
	if err != nil {
		log.Fatalf("Query failed: %v", err)
	}
	enrollments := dashboardHelper(results)
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
			})
			log.Printf("enrollments: %v", enrollments)
		}
	}

	// get activity for past 7 days
	var activities []models.RecentActivity

	err = db.Conn.Table("activities a").
		Select(`DATE(a.created_at) as date, SUM(a.time_delta) as delta`).
		Where("a.user_id = ? AND a.created_at >= ?", userID, time.Now().AddDate(0, 0, -7)).
		Group("date").
		Find(&activities).Error
	if err != nil {
		log.Fatalf("Query failed: %v", err)
	}

	return models.UserDashboardJoin{Enrollments: enrollments, RecentPrograms: recentPrograms, TopPrograms: topPrograms, WeekActivity: activities}, err
}

func (db *DB) GetAdminDashboardInfo(facilityID uint) (models.AdminDashboardJoin, error) {
	var dashboard models.AdminDashboardJoin

	// facility name
	err := db.Conn.Table("facilities f").
		Select("f.name as facility_name").
		Where("f.id = ?", facilityID).
		Find(&dashboard.FacilityName).Error
	if err != nil {
		return dashboard, err
	}

	// Monthly Activity
	err = db.Conn.Table("activities a").
		Select("TO_CHAR(a.created_at, 'YYYY-MM-DD') as date, ROUND(SUM(a.time_delta) / 3600.0,2) as delta").
		Joins("JOIN users u ON a.user_id = u.id").
		Where("u.facility_id = ? AND a.created_at >= ?", facilityID, time.Now().AddDate(0, -1, 0)).
		Group("TO_CHAR(a.created_at, 'YYYY-MM-DD')").
		Find(&dashboard.MonthlyActivity).Error
	if err != nil {
		return dashboard, err
	}

	// Weekly Active Users, Average Daily Activity, Total Weekly Activity
	var result struct {
		WeeklyActiveUsers   uint
		AvgDailyActivity    float64
		TotalWeeklyActivity uint
	}

	err = db.Conn.Table("activities a").
		Select(`
			COUNT(DISTINCT a.user_id) as weekly_active_users, 
			AVG(a.time_delta) as avg_daily_activity,
			SUM(a.time_delta) as total_weekly_activity`).
		Joins("JOIN users u ON a.user_id = u.id").
		Where("u.facility_id = ? AND a.created_at >= ?", facilityID, time.Now().AddDate(0, 0, -7)).
		Find(&result).Error
	if err != nil {
		log.Fatalf("Query failed: %v", err)
	}

	dashboard.WeeklyActiveUsers = result.WeeklyActiveUsers
	dashboard.AvgDailyActivity = uint(result.AvgDailyActivity)
	dashboard.TotalWeeklyActivity = result.TotalWeeklyActivity

	// Program Milestones
	err = db.Conn.Table("programs p").
		Select("p.name as name, COALESCE(COUNT(m.id), 0) as milestones").
		Joins("LEFT JOIN milestones m ON m.program_id = p.id AND m.created_at >= ?", time.Now().AddDate(0, 0, -7)).
		Joins("LEFT JOIN users u ON m.user_id = u.id AND u.facility_id = ?", facilityID).
		Group("p.name").
		Order("milestones DESC").
		Limit(5).
		Find(&dashboard.ProgramMilestones).Error
	if err != nil {
		return dashboard, err
	}

	// Top 5 Programs by Hours Engaged
	err = db.Conn.Table("activities a").
		Select("p.name as program_name, p.alt_name as alt_name, SUM(a.time_delta) / 3600.0 as hours_engaged").
		Joins("JOIN programs p ON a.program_id = p.id").
		Joins("JOIN users u ON a.user_id = u.id").
		Where("u.facility_id = ? AND a.created_at >= ?", facilityID, time.Now().AddDate(0, 0, -7)).
		Group("p.id").
		Order("hours_engaged DESC").
		Limit(5).
		Find(&dashboard.TopProgramActivity).Error
	if err != nil {
		return dashboard, err
	}

	return dashboard, nil
}
