package database

import (
	"UnlockEdv2/src/models"
	"fmt"
	"math"
	"sort"
	"time"
)

func (db *DB) GetDailyActivityByUserID(userID int, startDate time.Time, endDate time.Time) ([]models.DailyActivity, error) {
	days := int(math.Ceil(endDate.Sub(startDate).Hours() / 24))
	activities := make([]models.Activity, 0, days)
	if err := db.Where("user_id = ? AND created_at BETWEEN ? AND ?", userID, startDate, endDate).Find(&activities).Error; err != nil {
		return nil, newGetRecordsDBError(err, "activities")
	}
	// Combine activities based on date
	dailyActivities := make(map[time.Time]models.DailyActivity, days)
	for _, activity := range activities {
		date := activity.CreatedAt.Truncate(24 * time.Hour)
		if dailyActivity, ok := dailyActivities[date]; ok {
			dailyActivity.TotalTime += uint(activity.TimeDelta)
			dailyActivity.Activities = append(dailyActivity.Activities, activity)
			dailyActivities[date] = dailyActivity
		} else {
			dailyActivities[date] = models.DailyActivity{
				Date:       date,
				TotalTime:  uint(activity.TimeDelta),
				Activities: []models.Activity{activity},
			}
		}
	}

	// Convert map to slice
	var dailyActivityList []models.DailyActivity
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

func (db *DB) GetTotalCoursesOffered(facilityID *uint) (int, error) {
	var totalCourses int
	subQry := db.Table("courses c").
		Select("COUNT(DISTINCT c.id) as total_courses_offered").
		Joins("INNER JOIN user_enrollments ue on c.id = ue.course_id").
		Joins("INNER JOIN users u on ue.user_id = u.id")

	if facilityID != nil {
		subQry = subQry.Where("u.facility_id = ?", facilityID)
	}

	err := subQry.Find(&totalCourses).Error
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
	subQry := db.Table("activities a").
		Select("CAST(COALESCE(ROUND(SUM(a.total_time)/3600, 0), 0) AS INTEGER) AS total_activity_time").
		Joins("INNER JOIN users u ON u.id = a.user_id")
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
	qry := `
	SELECT
	    sub.name AS course_name,
	    sub.completions AS total_students_completed,
	    sub.enrollments AS total_students_enrolled,
	    COALESCE(sub.activity_hours, 0) AS activity_hours,
	    CASE
	        WHEN COALESCE(sub.completions, 0) = 0 THEN 0
	        ELSE %s
	    END AS completion_rate
	FROM (
	    SELECT
	        c.id AS course_id,
	        c.name,
	        COUNT(DISTINCT ue.user_id) AS enrollments,
	        (SELECT COUNT(DISTINCT o.user_id) FROM outcomes o WHERE o.course_id = c.id) AS completions,
	        (SELECT ROUND(COALESCE(SUM(a.total_time) / 3600, 0), 2)
	         FROM activities a WHERE a.course_id = c.id) AS activity_hours
	    FROM courses c
	    LEFT JOIN user_enrollments ue ON ue.course_id = c.id
	    GROUP BY c.id, c.name
	) AS sub
	ORDER BY sub.course_id
`
	sqlFunc := `ROUND(COALESCE(sub.completions, 0)::NUMERIC / COALESCE(sub.enrollments, 0) * 100, 2)`

	if db.Dialector.Name() == "sqlite" {
		sqlFunc = `ROUND(CAST(COALESCE(sub.completions, 0) AS REAL) /
               CAST(NULLIF(sub.enrollments, 0) AS REAL) * 100, 2)`
	}

	err := db.Raw(fmt.Sprintf(qry, sqlFunc)).Find(&insights).Error
	if err != nil {
		return nil, NewDBError(err, "error getting learning insights")
	}
	return insights, nil
}
