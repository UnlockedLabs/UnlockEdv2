package database

import (
	"UnlockEdv2/src/models"
	"slices"
)

func (db *DB) GetOutcomesForUser(args *models.QueryContext, outcomeType models.OutcomeType) ([]models.Outcome, error) {
	var outcomes []models.Outcome
	fields := []string{"created_at", "type"}
	if !slices.Contains(fields, args.OrderBy) {
		args.OrderBy = "created_at"
	}

	query := db.WithContext(args.Ctx).Model(&models.Outcome{}).Where("user_id = ?", args.UserID)

	if outcomeType != "" {
		query = query.Where("type = ?", outcomeType)
	}

	if err := query.Count(&args.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "outcomes")
	}
	return outcomes, query.Order(args.OrderClause("outcomes.created_at DESC")).Offset(args.CalcOffset()).Limit(args.PerPage).Find(&outcomes).Error
}
