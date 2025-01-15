package database

import (
	"UnlockEdv2/src/models"
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
