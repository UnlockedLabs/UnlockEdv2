package database

import (
	"UnlockEdv2/src/models"
	"fmt"
	"slices"
	"strings"
	"time"
)

type UserCatalogJoin struct {
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

func (db *DB) GetUserCatalog(userId int, tags []string, search, order string) ([]UserCatalogJoin, error) {
	catalog := []UserCatalogJoin{}
	tx := db.Table("courses c").
		Select(`c.id as course_id, c.thumbnail_url, c.name as course_name,
		pp.name as provider_name, c.external_url, c.type as course_type, c.description, c.outcome_types, c.start_dt, c.end_dt`).
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
	err := tx.Scan(&catalog).Error
	if err != nil {
		return nil, NewDBError(err, "error getting user catalog info")
	}
	return catalog, nil
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
	Description    string     `json:"description"`
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

func (db *DB) GetUserCourses(qCtx *models.QueryContext) (UserCoursesInfo, error) {
	var courseInfo UserCoursesInfo
	courses := []UserCourses{}
	fieldMap := map[string]string{
		"course_name":     "c.name",
		"provider_name":   "pp.name",
		"course_progress": "course_progress",
		"total_time":      "total_time",
		"start_dt":        "c.start_dt",
		"end_dt":          "c.end_dt",
		"recent_activity": "a.last_ts",
	}
	dbField, ok := fieldMap[qCtx.OrderBy]
	if !ok {
		dbField = "c.name"
	}
	orderStr := dbField + " " + validOrder(qCtx.Order)
	tx := db.Table("courses c").
		Select(`c.id, c.thumbnail_url,
		c.name as course_name, c.description, pp.name as provider_name, c.external_url, c.start_dt, c.end_dt,
		progress.course_progress, a.total_time as total_time`).
		Joins("JOIN provider_platforms pp ON c.provider_platform_id = pp.id").
		Joins("JOIN milestones as m ON m.course_id = c.id and m.user_id = ?", qCtx.UserID).
		Joins(`JOIN (Select cc.id,
				CASE WHEN EXISTS (SELECT 1 FROM outcomes o WHERE o.course_id = cc.id AND o.user_id = ?) THEN 100
					WHEN cc.total_progress_milestones = 0 THEN 0
				ELSE
				CASE WHEN (SELECT COUNT(m.id) * 100.0 / cc.total_progress_milestones
						FROM milestones m
						WHERE m.course_id = cc.id AND m.user_id = ?) = 100 THEN 99.999
				ELSE (SELECT COUNT(m.id) * 100.0 / cc.total_progress_milestones
					FROM milestones m
					WHERE m.course_id = cc.id AND m.user_id = ?
				) END
				END as course_progress
				from courses cc 
				where cc.deleted_at IS NULL
				) progress on progress.id = c.id`, qCtx.UserID, qCtx.UserID, qCtx.UserID).
		Joins(`LEFT JOIN user_course_activity_totals a on a.course_id = c.id and a.user_id = m.user_id`).
		Joins("LEFT JOIN outcomes o ON o.course_id = c.id AND o.user_id = m.user_id").
		Where("c.deleted_at IS NULL").
		Where("pp.deleted_at IS NULL")

	tx = tx.Order(orderStr)

	if qCtx.Search != "" {
		tx = tx.Where("LOWER(c.name) LIKE ?", "%"+qCtx.Search+"%")
	}
	for i, tag := range qCtx.Tags {
		var query string
		switch tag {
		case "completed":
			query = "o.type IS NOT NULL"
		case "in_progress":
			query = "o.type IS NULL"
		}
		if i == 0 {
			tx.Where(query)
		} else {
			tx.Or(query)
		}
	}
	tx.Group("c.id, c.name, c.description, c.start_dt, c.end_dt, a.total_time, c.thumbnail_url, pp.name, c.external_url, progress.course_progress, a.last_ts")
	err := tx.Scan(&courses).Error
	if err != nil {
		return courseInfo, NewDBError(err, "error getting user programs")
	}
	var (
		totalTime     uint
		numCompleted  int64
		numInProgress int64
	)
	for _, course := range courses {
		totalTime += course.TotalTime
		if int(course.CourseProgress) == 100 {
			numCompleted++
		} else {
			numInProgress++
		}
	}
	courseInfo.Completed = uint(numCompleted)
	courseInfo.InProgress = uint(numInProgress)
	courseInfo.TotalTime = totalTime
	courseInfo.Courses = courses
	return courseInfo, nil
}
