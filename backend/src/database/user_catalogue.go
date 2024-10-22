package database

import (
	"UnlockEdv2/src/models"
	"fmt"
	"slices"
	"strings"
)

type UserCatalogueJoin struct {
	CourseID     uint   `json:"course_id"`
	ThumbnailURL string `json:"thumbnail_url"`
	CourseName   string `json:"course_name"`
	ProviderName string `json:"provider_name"`
	ExternalURL  string `json:"external_url"`
	CourseType   string `json:"course_type"`
	Description  string `json:"description"`
	IsFavorited  bool   `json:"is_favorited"`
	OutcomeTypes string `json:"outcome_types"`
}

func (db *DB) GetUserCatalogue(userId int, tags []string, search, order string) ([]UserCatalogueJoin, error) {
	catalogue := []UserCatalogueJoin{}
	tx := db.Table("courses c").
		Select("c.id as course_id, c.thumbnail_url, c.name as course_name, pp.name as provider_name, c.external_url, c.type as course_type, c.description, c.outcome_types, f.user_id IS NOT NULL as is_favorited").
		Joins("LEFT JOIN provider_platforms pp ON c.provider_platform_id = pp.id").
		Joins("LEFT JOIN favorites f ON f.course_id = c.id AND f.user_id = ?", userId).
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

type UserCourses struct {
	ID             uint    `json:"id"`
	ThumbnailURL   string  `json:"thumbnail_url"`
	CourseName     string  `json:"course_name"`
	ProviderName   string  `json:"provider_platform_name"`
	ExternalURL    string  `json:"external_url"`
	CourseProgress float64 `json:"course_progress"`
	IsFavorited    bool    `json:"is_favorited"`
	TotalTime      uint    `json:"total_time"`
}

func validOrder(str string) string {
	if slices.Contains([]string{"asc", "desc"}, strings.ToLower(str)) {
		return strings.ToLower(str)
	}
	return "desc"
}

func (db *DB) GetUserCourses(userId uint, order string, orderBy string, search string, tags []string) ([]UserCourses, uint, uint, error) {
	courses := []UserCourses{}
	fieldMap := map[string]string{
		"course_name":     "c.name",
		"provider_name":   "pp.name",
		"course_progress": "course_progress",
		"is_favorited":    "is_favorited",
		"total_time":      "a.total_time",
	}
	dbField, ok := fieldMap[orderBy]
	if !ok {
		dbField = "c.name"
	}
	orderStr := dbField + " " + validOrder(order)

	tx := db.Table("courses c").
		Select(`c.id, c.thumbnail_url,
    c.name as course_name, pp.name as provider_name, c.external_url,
    f.user_id IS NOT NULL as is_favorited,
    CASE
        WHEN EXISTS (SELECT 1 FROM outcomes o WHERE o.course_id = c.id AND o.user_id = ?) THEN 100
        WHEN c.total_progress_milestones = 0 THEN 0
        ELSE
           CASE WHEN (SELECT COUNT(m.id) * 100.0 / c.total_progress_milestones
              FROM milestones m
              WHERE m.course_id = c.id AND m.user_id = ?) = 100 THEN 99.999
          ELSE (SELECT COUNT(m.id) * 100.0 / c.total_progress_milestones) END
    END as course_progress,
    a.total_time`, userId, userId).
		Joins("LEFT JOIN provider_platforms pp ON c.provider_platform_id = pp.id").
		Joins("JOIN milestones as m ON m.course_id = c.id AND m.user_id = ?", userId).
		Joins("LEFT JOIN favorites f ON f.course_id = c.id AND f.user_id = ?", userId).
		Joins("LEFT JOIN outcomes o ON o.course_id = c.id AND o.user_id = ?", userId).
		Joins(`LEFT JOIN activities a ON a.id = (
        SELECT id FROM activities
        WHERE course_id = c.id AND user_id = ?
        ORDER BY created_at DESC
        LIMIT 1
    )`, userId).
		Where("c.deleted_at IS NULL").
		Where("pp.deleted_at IS NULL")

	tx = tx.Order(orderStr)

	if search != "" {
		tx = tx.Where("LOWER(c.name) LIKE ?", "%"+search+"%")
	}
	for i, tag := range tags {
		var query string
		switch tag {
		case "is_favorited":
			query = "f.user_id IS NOT NULL"
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

	tx.Group("c.id, c.name, c.thumbnail_url, pp.name, c.external_url, f.user_id, a.total_time")
	err := tx.Scan(&courses).Error
	if err != nil {
		return nil, 0, 0, NewDBError(err, "error getting user programs")
	}

	var numCompleted int64
	if err := db.Model(&models.Outcome{}).Where("user_id = ?", userId).Count(&numCompleted).Error; err != nil {
		return nil, 0, 0, NewDBError(err, "error getting user programs")
	}
	var totalTime uint
	for _, course := range courses {
		totalTime += course.TotalTime
	}

	return courses, uint(numCompleted), totalTime, nil
}
