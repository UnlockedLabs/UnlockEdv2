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

func (db *DB) GetDailyActivityByUserID(userID int, startDate time.Time, endDate time.Time) ([]DailyActivity, error) {
	days := int(math.Ceil(endDate.Sub(startDate).Hours() / 24))
	activities := make([]models.Activity, 0, days)
	if err := db.Where("user_id = ? AND created_at BETWEEN ? AND ?", userID, startDate, endDate).Find(&activities).Error; err != nil {
		return nil, newGetRecordsDBError(err, "activities")
	}
	// Combine activities based on date
	dailyActivities := make(map[time.Time]DailyActivity, days)
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
	activities := make([]models.Activity, 0, perPage)
	var count int64
	tx := db.Model(&models.Activity{}).Where("course_id = ?", courseID)
	if err := tx.Count(&count).Error; err != nil {
		return count, nil, newGetRecordsDBError(err, "activities")
	}
	if err := tx.Offset(calcOffset(page, perPage)).Limit(perPage).Find(&activities).Error; err != nil {
		return count, nil, newGetRecordsDBError(err, "activities")
	}
	return count, activities, nil
}

func (db *DB) DeleteActivity(activityID int) error {
	return db.Delete(&models.Activity{}, activityID).Error
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
func (db *DB) GetTotalCoursesOffered(facilityID *uint) (int, error) {
	var totalCourses int
	subQry := db.Table("courses c").
		Select("COUNT(DISTINCT c.id) AS facility_course_count, f.id AS facility_id").
		Joins("INNER JOIN user_enrollments ue ON c.id = ue.course_id").
		Joins("INNER JOIN users u ON ue.user_id = u.id").
		Joins("INNER JOIN facilities f ON u.facility_id = f.id").
		Group("f.id")
	if facilityID != nil {
		subQry = subQry.Where("u.facility_id = ?", facilityID)
	}

	err := db.Table("(?) AS sub", subQry).
		Select("COALESCE(SUM(sub.facility_course_count), 0)").
		Scan(&totalCourses).Error
	if err != nil {
		return 0, NewDBError(err, "error getting total courses offered")
	}
	return totalCourses, nil
}

func (db *DB) GetTotalStudentsEnrolled(facilityID *uint) (int, error) {
	var totalStudents int
	query := db.Table("user_enrollments ue").
		Select("COUNT(DISTINCT ue.user_id) AS students_enrolled").
		Joins("INNER JOIN users u on ue.user_id = u.id")

	if facilityID != nil {
		query = query.Where("u.facility_id = ?", facilityID)
	}

	err := query.Scan(&totalStudents).Error
	if err != nil {
		return 0, NewDBError(err, "error getting total students enrolled")
	}
	return totalStudents, nil
}

func (db *DB) GetTotalHourlyActivity(facilityID *uint) (int, error) {
	var totalActivity int
	subQry := db.Table("users u").
		Select("CASE WHEN SUM(a.total_time) IS NULL THEN 0 ELSE ROUND(SUM(a.total_time)/3600, 0) END AS total_time").
		Joins("LEFT JOIN activities a ON u.id = a.user_id").
		Where("u.role = ?", "student")

	if facilityID != nil {
		subQry = subQry.Where("u.facility_id = ?", facilityID)
	}

	err := subQry.Scan(&totalActivity).Error
	if err != nil {
		return 0, NewDBError(err, "error getting total hourly activity")
	}
	return totalActivity, nil
}

func (db *DB) GetLearningInsights(facilityID *uint) ([]models.LearningInsight, error) {
	var insights []models.LearningInsight
	subQry := db.Table("outcomes o").
		Select("o.course_id, COUNT(o.id) AS outcome_count").
		Group("o.course_id")

	subQry2 := db.Table("courses c").
		Select(`
			c.name AS course_name,
			COUNT(DISTINCT u.id) AS total_students_enrolled,
			CASE 
				WHEN MAX(subqry.outcome_count) > 0 THEN  
					COUNT(DISTINCT u.id) / NULLIF(CAST(MAX(c.total_progress_milestones) AS float), 0) * 100.0
				ELSE 0
			END AS completion_rate,
			COALESCE(ROUND(SUM(a.total_time) / 3600, 0), 0) AS activity_hours
		`).
		Joins("LEFT JOIN milestones m ON m.course_id = c.id").
		Joins("LEFT JOIN users u ON m.user_id = u.id").
		Joins("LEFT JOIN activities a ON u.id = a.user_id").
		Joins("INNER JOIN (?) AS subqry ON m.course_id = subqry.course_id", subQry).
		Where("u.role = ?", "student")

	if facilityID != nil {
		subQry2 = subQry2.Where("u.facility_id = ?", facilityID)
	}

	err := subQry2.Group("c.name, c.total_progress_milestones").Find(&insights).Error
	if err != nil {
		return nil, NewDBError(err, "error getting learning insights")
	}
	return insights, nil
}
