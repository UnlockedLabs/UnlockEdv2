package database

type UserCatalogueJoin struct {
	ProgramID    uint   `json:"program_id"`
	ThumbnailURL string `json:"thumbnail_url"`
	ProgramName  string `json:"program_name"`
	ProviderName string `json:"provider_name"`
	ExternalURL  string `json:"external_url"`
	ProgramType  string `json:"program_type"`
	IsFavorited  bool   `json:"is_favorited"`
	OutcomeTypes string `json:"outcome_types"`
}

func (db *DB) GetUserCatalogue(userId int, tags []string) ([]UserCatalogueJoin, error) {
	catalogue := []UserCatalogueJoin{}
	tx := db.Conn.Table("programs p").
		Select("p.id as program_id, p.thumbnail_url, p.name as program_name, pp.name as provider_name, p.external_url, p.type as program_type, p.outcome_types, f.user_id IS NOT NULL as is_favorited").
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
	ThumbnailURL   string  `json:"thumbnail_url"`
	ProgramName    string  `json:"program_name"`
	ProviderName   string  `json:"provider_name"`
	ExternalURL    string  `json:"external_url"`
	CourseProgress float64 `json:"course_progress"`
	IsFavorited    bool    `json:"is_favorited"`
}

func (db *DB) GetUserPrograms(userId uint, tags []string) ([]UserPrograms, error) {
	programs := []UserPrograms{}
	tx := db.Conn.Table("programs p").
		Select(`p.thumbnail_url,
    p.name as program_name, pp.name as provider_name, p.external_url,
    f.user_id IS NOT NULL as is_favorited,
    COUNT(milestones.id) * 100.0 / p.total_progress_milestones as course_progress`).
		Joins("LEFT JOIN provider_platforms pp ON p.provider_platform_id = pp.id").
		Joins("LEFT JOIN milestones on milestones.program_id = p.id AND milestones.user_id = ?", userId).
		Joins("LEFT JOIN favorites f ON f.program_id = p.id AND f.user_id = ?", userId).
		Where("p.deleted_at IS NULL").
		Where("pp.deleted_at IS NULL")
	for i, tag := range tags {
		var query string
		switch tag {
		case "is_favorited":
			query = "is_favorited = true"
		case "completed":
			query = "milestones.is_completed = true"
		case "in_progress":
			query = "milestones.is_completed = false"
		}
		if i == 0 {
			tx.Where(query)
		} else {
			tx.Or(query)
		}
	}
	tx.Group("p.name, p.thumbnail_url, pp.name, p.external_url, f.user_id, p.total_progress_milestones")
	err := tx.Scan(&programs).Error
	if err != nil {
		return nil, err
	}
	return programs, nil
}
