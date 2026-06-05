package database

import (
	"UnlockEdv2/src/models"
	"math"
	"time"

	"gorm.io/gorm"
)

func kcPriorWindow(start, end *time.Time) (*time.Time, *time.Time) {
	if start == nil || end == nil {
		return nil, nil
	}
	duration := end.Sub(*start)
	priorStart := start.Add(-duration)
	priorEnd := *start
	return &priorStart, &priorEnd
}

func kcPctChange(current, prior int64) int {
	if prior <= 0 {
		return 0
	}
	return int(math.Round(float64(current-prior) / float64(prior) * 100))
}

func (db *DB) kcActivityScope(args *models.QueryContext, start, end *time.Time, facilityID *uint) *gorm.DB {
	tx := db.WithContext(args.Ctx).Model(&models.OpenContentActivity{})
	if facilityID != nil {
		tx = tx.Where("facility_id = ?", *facilityID)
	}
	if start != nil && end != nil {
		tx = tx.Where("request_ts >= ? AND request_ts < ?", *start, *end)
	}
	return tx
}

func (db *DB) GetKCInteractionStats(args *models.QueryContext, start, end *time.Time, facilityID *uint) (int64, int64, int, error) {
	var total int64
	if err := db.kcActivityScope(args, start, end, facilityID).Count(&total).Error; err != nil {
		return 0, 0, 0, newGetRecordsDBError(err, "open_content_activities")
	}
	var unique int64
	if err := db.kcActivityScope(args, start, end, facilityID).
		Distinct("user_id").Count(&unique).Error; err != nil {
		return 0, 0, 0, newGetRecordsDBError(err, "open_content_activities")
	}
	change := 0
	if priorStart, priorEnd := kcPriorWindow(start, end); priorStart != nil {
		var priorTotal int64
		if err := db.kcActivityScope(args, priorStart, priorEnd, facilityID).Count(&priorTotal).Error; err != nil {
			return 0, 0, 0, newGetRecordsDBError(err, "open_content_activities")
		}
		change = kcPctChange(total, priorTotal)
	}
	return total, unique, change, nil
}

func (db *DB) GetKCAvgSessionMinutes(args *models.QueryContext, start, end *time.Time, facilityID *uint) (float64, error) {
	type sessionRow struct {
		RequestTS time.Time
		StopTS    time.Time
	}
	rows := make([]sessionRow, 0)
	if err := db.kcActivityScope(args, start, end, facilityID).
		Select("request_ts, stop_ts").
		Where("stop_ts IS NOT NULL").
		Find(&rows).Error; err != nil {
		return 0, newGetRecordsDBError(err, "open_content_activities")
	}
	var totalMinutes float64
	var counted int
	for _, row := range rows {
		if row.StopTS.After(row.RequestTS) {
			totalMinutes += row.StopTS.Sub(row.RequestTS).Minutes()
			counted++
		}
	}
	if counted == 0 {
		return 0, nil
	}
	return totalMinutes / float64(counted), nil
}

func (db *DB) GetKCRepeatEngagement(args *models.QueryContext, start, end *time.Time, facilityID *uint) (models.RepeatEngagement, error) {
	type userCount struct {
		UserID uint
		Cnt    int64
	}
	counts := make([]userCount, 0)
	if err := db.kcActivityScope(args, start, end, facilityID).
		Select("user_id, count(*) as cnt").
		Group("user_id").
		Find(&counts).Error; err != nil {
		return models.RepeatEngagement{}, newGetRecordsDBError(err, "open_content_activities")
	}
	var engagement models.RepeatEngagement
	for _, row := range counts {
		switch {
		case row.Cnt >= 5:
			engagement.FivePlus++
		case row.Cnt >= 2:
			engagement.TwoToFour++
		default:
			engagement.Once++
		}
	}
	return engagement, nil
}

func (db *DB) GetKCLibraryViewsByCategory(args *models.QueryContext, start, end *time.Time, facilityID *uint) ([]models.CategoryViews, error) {
	views := make([]models.CategoryViews, 0)
	tx := db.WithContext(args.Ctx).Table("open_content_activities oca").
		Select("t.name as category, count(oca.id) as views").
		Joins("JOIN open_content_tags oct ON oct.content_id = oca.content_id AND oct.open_content_provider_id = oca.open_content_provider_id").
		Joins("JOIN tags t ON t.id = oct.tag_id")
	if facilityID != nil {
		tx = tx.Where("oca.facility_id = ?", *facilityID)
	}
	if start != nil && end != nil {
		tx = tx.Where("oca.request_ts >= ? AND oca.request_ts < ?", *start, *end)
	}
	if err := tx.Group("t.name").Order("views DESC, t.name ASC").Scan(&views).Error; err != nil {
		return nil, newGetRecordsDBError(err, "open_content_tags")
	}
	return views, nil
}

func (db *DB) getKCTopContent(args *models.QueryContext, table, alias string, start, end *time.Time, facilityID *uint, limit int) ([]models.KCContentRow, error) {
	type contentRow struct {
		ContentID uint
		Title     string
		Visits    int64
	}
	current := make([]contentRow, 0, limit)
	tx := db.WithContext(args.Ctx).Table("open_content_activities oca").
		Select(alias + ".id as content_id, " + alias + ".title as title, count(oca.id) as visits").
		Joins("JOIN " + table + " " + alias + " ON " + alias + ".id = oca.content_id AND " + alias + ".open_content_provider_id = oca.open_content_provider_id AND " + alias + ".deleted_at IS NULL")
	if facilityID != nil {
		tx = tx.Where("oca.facility_id = ?", *facilityID)
	}
	if start != nil && end != nil {
		tx = tx.Where("oca.request_ts >= ? AND oca.request_ts < ?", *start, *end)
	}
	if err := tx.Group(alias + ".id, " + alias + ".title").
		Order("visits DESC, " + alias + ".title ASC").
		Limit(limit).
		Scan(&current).Error; err != nil {
		return nil, newGetRecordsDBError(err, table)
	}
	rows := make([]models.KCContentRow, 0, len(current))
	if len(current) == 0 {
		return rows, nil
	}

	priorVisits := make(map[uint]int64)
	if priorStart, priorEnd := kcPriorWindow(start, end); priorStart != nil {
		ids := make([]uint, 0, len(current))
		for _, c := range current {
			ids = append(ids, c.ContentID)
		}
		priors := make([]contentRow, 0, len(ids))
		ptx := db.WithContext(args.Ctx).Table("open_content_activities oca").
			Select(alias+".id as content_id, count(oca.id) as visits").
			Joins("JOIN "+table+" "+alias+" ON "+alias+".id = oca.content_id AND "+alias+".open_content_provider_id = oca.open_content_provider_id AND "+alias+".deleted_at IS NULL").
			Where(alias+".id IN ?", ids).
			Where("oca.request_ts >= ? AND oca.request_ts < ?", *priorStart, *priorEnd)
		if facilityID != nil {
			ptx = ptx.Where("oca.facility_id = ?", *facilityID)
		}
		if err := ptx.Group(alias + ".id").Scan(&priors).Error; err != nil {
			return nil, newGetRecordsDBError(err, table)
		}
		for _, p := range priors {
			priorVisits[p.ContentID] = p.Visits
		}
	}

	for _, c := range current {
		rows = append(rows, models.KCContentRow{
			Title:  c.Title,
			Visits: c.Visits,
			Change: kcPctChange(c.Visits, priorVisits[c.ContentID]),
		})
	}
	return rows, nil
}

func (db *DB) GetKCTopLibraries(args *models.QueryContext, start, end *time.Time, facilityID *uint, limit int) ([]models.KCContentRow, error) {
	return db.getKCTopContent(args, "libraries", "l", start, end, facilityID, limit)
}

func (db *DB) GetKCTopVideos(args *models.QueryContext, start, end *time.Time, facilityID *uint, limit int) ([]models.KCContentRow, error) {
	return db.getKCTopContent(args, "videos", "v", start, end, facilityID, limit)
}
