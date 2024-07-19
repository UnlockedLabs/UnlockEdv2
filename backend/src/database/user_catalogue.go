package database

import (
	"slices"
	"strings"
)

type UserCatalogueJoin struct {
	ProgramID    uint   `json:"program_id"`
	ThumbnailURL string `json:"thumbnail_url"`
	ProgramName  string `json:"program_name"`
	ProviderName string `json:"provider_name"`
	ExternalURL  string `json:"external_url"`
	ProgramType  string `json:"program_type"`
	Description  string `json:"description"`
	IsFavorited  bool   `json:"is_favorited"`
	OutcomeTypes string `json:"outcome_types"`
}

func (db *DB) GetUserCatalogue(userId int, tags []string) ([]UserCatalogueJoin, error) {
	catalogue := []UserCatalogueJoin{}
	tx := db.Conn.Table("programs p").
		Select("p.id as program_id, p.thumbnail_url, p.name as program_name, pp.name as provider_name, p.external_url, p.type as program_type, p.description, p.outcome_types, f.user_id IS NOT NULL as is_favorited").
		Joins("LEFT JOIN provider_platforms pp ON p.provider_platform_id = pp.id").
		Joins("LEFT JOIN favorites f ON f.program_id = p.id AND f.user_id = ?", userId).
		Where("p.deleted_at IS NULL").
		Where("pp.deleted_at IS NULL")
	for i, tag := range tags {
		if i == 0 {
			tx.Where("p.outcome_types ILIKE ?", "%"+tag+"%")
		} else {
			tx.Or("p.outcome_types ILIKE ?", "%"+tag+"%")
		}
		tx.Or("p.type ILIKE ?", "%"+tag+"%")
	}
	err := tx.Scan(&catalogue).Error
	if err != nil {
		return nil, err
	}
	return catalogue, nil
}

type UserPrograms struct {
	ID             uint    `json:"id"`
	ThumbnailURL   string  `json:"thumbnail_url"`
	ProgramName    string  `json:"program_name"`
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

func (db *DB) GetUserPrograms(userId uint, order string, orderBy string, search string, tags []string) ([]UserPrograms, uint, uint, error) {
	programs := []UserPrograms{}
	fieldMap := map[string]string{
		"program_name":    "p.name",
		"provider_name":   "pp.name",
		"course_progress": "course_progress",
		"is_favorited":    "is_favorited",
	}
	dbField, ok := fieldMap[orderBy]
	if !ok {
		dbField = "p.name"
	}
	orderStr := dbField + " " + validOrder(order)
	tx := db.Conn.Table("programs p").
		Select(`p.id, p.thumbnail_url,
    p.name as program_name, pp.name as provider_name, p.external_url,
    f.user_id IS NOT NULL as is_favorited,
    CASE
        WHEN EXISTS (SELECT 1 FROM outcomes o WHERE o.program_id = p.id AND o.user_id = ?) THEN 100
        WHEN p.total_progress_milestones = 0 THEN 0
        ELSE (SELECT COUNT(m.id) * 100.0 / p.total_progress_milestones
              FROM milestones m
              WHERE m.program_id = p.id AND m.user_id = ?)
    END as course_progress,
    a.total_time`, userId, userId).
		Joins("LEFT JOIN provider_platforms pp ON p.provider_platform_id = pp.id").
		Joins("LEFT JOIN (SELECT * FROM milestones WHERE user_id = ?) as m ON m.program_id = p.id", userId).
		Joins("LEFT JOIN favorites f ON f.program_id = p.id AND f.user_id = ?", userId).
		Joins("LEFT JOIN outcomes o ON o.program_id = p.id AND o.user_id = ?", userId).
		Joins(`LEFT JOIN activities a ON a.id = (
        SELECT id FROM activities 
        WHERE program_id = p.id AND user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
    )`, userId).
		Where("p.deleted_at IS NULL").
		Where("pp.deleted_at IS NULL").
		Where("m.user_id IS NOT NULL")
	tx = tx.Order(orderStr)

	if search != "" {
		tx = tx.Where("LOWER(p.name) LIKE ?", "%"+search+"%")
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

	tx.Group("p.id, p.name, p.thumbnail_url, pp.name, p.external_url, f.user_id, p.total_progress_milestones, a.total_time")
	err := tx.Scan(&programs).Error
	if err != nil {
		return nil, 0, 0, err
	}

	var numCompleted uint
	var totalTime uint
	for _, program := range programs {
		if program.CourseProgress == 100 {
			numCompleted++
		}
		totalTime += program.TotalTime
	}

	return programs, numCompleted, totalTime, nil
}
