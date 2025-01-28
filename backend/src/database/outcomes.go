package database

import (
	"UnlockEdv2/src/models"
)

func (db *DB) GetOutcomesForUser(args *models.QueryContext, outcomeType models.OutcomeType) ([]models.Outcome, error) {
	var outcomes []models.Outcome
	fieldMap := map[string]string{
		"created_at": "created_at",
		"type":       "type",
	}
	dbField, ok := fieldMap[args.OrderBy]
	if !ok {
		dbField = "created_at"
	}
	orderStr := dbField + " " + validOrder(args.Order)

	query := db.Model(&models.Outcome{}).Where("user_id = ?", args.UserID)

	if outcomeType != "" {
		query = query.Where("type = ?", outcomeType)
	}

	if err := query.Count(&args.Total).Error; err != nil {
		return nil, newGetRecordsDBError(err, "outcomes")
	}
	return outcomes, query.Order(orderStr).Offset(args.CalcOffset()).Limit(args.PerPage).Find(&outcomes).Error
}
