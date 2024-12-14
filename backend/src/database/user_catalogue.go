package database

import (
	"fmt"
	"slices"
	"sort"
	"strings"
	"time"
)

type UserCatalogueJoin struct {
	CourseID     uint       `json:"course_id"`
	ThumbnailURL string     `json:"thumbnail_url"`
	CourseName   string     `json:"course_name"`
	ProviderName string     `json:"provider_name"`
	ExternalURL  string     `json:"external_url"`
	CourseType   string     `json:"course_type"`
	Description  string     `json:"description"`
	OutcomeTypes string     `json:"outcome_types"`
	StartDt      *time.Time `json:"start_dt"`
	EndDt        *time.Time `json:"end_dt"`
}

func (db *DB) GetUserCatalogue(userId int, tags []string, search, order string) ([]UserCatalogueJoin, error) {
	catalogue := []UserCatalogueJoin{}
	tx := db.Table("courses c").
		Select("c.id as course_id, c.thumbnail_url, c.name as course_name, pp.name as provider_name, c.external_url, c.type as course_type, c.description, c.outcome_types, c.start_dt, c.end_dt").
		Joins("LEFT JOIN provider_platforms pp ON c.provider_platform_id = pp.id").
		Where("c.deleted_at IS NULL").
		Where("pp.deleted_at IS NULL")
	for i, tag := range tags {
		if i == 0 {
			tx.Where("LOWER(c.outcome_types) LIKE ?", "%"+strings.ToLower(tag)+"%")
		} else {
			tx.Or("LOWER(c.outcome_types) LIKE ?", "%"+strings.ToLower(tag)+"%")
		}
		tx.Or("LOWER(c.type) LIKE ?", "%"+strings.ToLower(tag)+"%")
	}
	if search != "" {
		tx.Where("LOWER(c.name) LIKE ?", "%"+search+"%")
	}
	tx.Order(fmt.Sprintf("c.name %s", validOrder(order)))
	err := tx.Scan(&catalogue).Error
	if err != nil {
		return nil, NewDBError(err, "error getting user catalogue info")
	}
	return catalogue, nil
}

type UserCoursesInfo struct {
	Courses    []UserCourses `json:"courses"`
	Completed  uint          `json:"num_completed"`
	InProgress uint          `json:"num_in_progress"`
	TotalTime  uint          `json:"total_time"`
}

type UserCourses struct {
	ID             uint       `json:"id"`
	ThumbnailURL   string     `json:"thumbnail_url"`
	CourseName     string     `json:"course_name"`
	ProviderName   string     `json:"provider_platform_name"`
	ExternalURL    string     `json:"external_url"`
	CourseProgress float64    `json:"course_progress"`
	TotalTime      uint       `json:"total_time"`
	StartDt        *time.Time `json:"start_dt"`
	EndDt          *time.Time `json:"end_dt"`
}

func validOrder(str string) string {
	if slices.Contains([]string{"asc", "desc"}, strings.ToLower(str)) {
		return strings.ToLower(str)
	}
	return "desc"
}

func (db *DB) GetUserCourses(userId uint, order string, orderBy string, search string, tags []string) (UserCoursesInfo, error) {
	var courseInfo UserCoursesInfo
	courses := []UserCourses{}
	fieldMap := map[string]string{
		"course_name":     "course_name",
		"provider_name":   "provider_name",
		"course_progress": "course_progress",
		"start_dt":        "start_dt",
		"end_dt":          "end_dt",
	}
	dbField, ok := fieldMap[orderBy]
	if !ok {
		dbField = "course_name"
	}
	orderStr := dbField + " " + validOrder(order)

	var tagFilter string
	if len(tags) > 0 {
		tagConditions := []string{}
		for _, tag := range tags {
			switch tag {
			case "completed":
				tagConditions = append(tagConditions, "progress.course_progress = 100")
			case "in_progress":
				tagConditions = append(tagConditions, "progress.course_progress < 100")
			}
		}
		if len(tagConditions) > 0 {
			tagFilter = "AND (" + strings.Join(tagConditions, " OR ") + ")"
		}
	}
	query := `WITH progress AS (
            SELECT 
                m.course_id,
                m.user_id,
                COUNT(m.id) * 100.0 / cc.total_progress_milestones AS course_progress
            FROM milestones m
            JOIN courses cc ON m.course_id = cc.id
            WHERE m.user_id = ? AND cc.deleted_at IS NULL
            GROUP BY m.course_id, m.user_id, cc.total_progress_milestones
        ),
        filtered_courses AS (
            SELECT 
                c.id, 
                c.thumbnail_url,
                c.name AS course_name, 
                pp.name AS provider_name, 
                c.external_url, 
                c.start_dt, 
                c.end_dt,
                COALESCE(progress.course_progress, 0) AS course_progress
            FROM courses c
            LEFT JOIN provider_platforms pp ON c.provider_platform_id = pp.id
            JOIN progress ON progress.course_id = c.id AND progress.user_id = ?
            WHERE c.deleted_at IS NULL 
            AND pp.deleted_at IS NULL 
            AND LOWER(c.name) LIKE ?
            ` + tagFilter + `
        )
        SELECT * FROM filtered_courses
        ORDER BY ` + orderStr

	searchTerm := "%" + strings.ToLower(search) + "%"
	err := db.Raw(query, userId, userId, searchTerm).Scan(&courses).Error
	if err != nil {
		return courseInfo, NewDBError(err, "error getting user courses")
	}

	courseIds := make([]uint, len(courses))
	for i, course := range courses {
		courseIds[i] = course.ID
	}

	activityQuery := `
        SELECT 
            a.course_id,
            MAX(a.total_time) AS total_time
        FROM activities a
        WHERE a.user_id = ? AND a.course_id IN (?) AND a.deleted_at IS NULL
        GROUP BY a.course_id;
    `

	var activityTimes []struct {
		CourseID  uint
		TotalTime uint
	}

	if err := db.Raw(activityQuery, userId, courseIds).Scan(&activityTimes).Error; err != nil {
		return courseInfo, NewDBError(err, "error getting activity times")
	}

	activityMap := make(map[uint]uint)
	for _, activity := range activityTimes {
		activityMap[activity.CourseID] = activity.TotalTime
	}

	var totalTime uint
	var numCompleted, numInProgress int64
	for i, course := range courses {
		if activityTime, exists := activityMap[course.ID]; exists {
			courses[i].TotalTime = activityTime
			totalTime += activityTime
		}
		if int(course.CourseProgress) == 100 {
			numCompleted++
		} else {
			numInProgress++
		}
	}
	// TODO: improve this whole function
	if orderBy == "total_time" {
		sort.Slice(courses, func(i, j int) bool {
			return courses[i].TotalTime > courses[j].TotalTime
		})
	}

	courseInfo.Completed = uint(numCompleted)
	courseInfo.InProgress = uint(numInProgress)
	courseInfo.TotalTime = totalTime
	courseInfo.Courses = courses

	return courseInfo, nil
}
