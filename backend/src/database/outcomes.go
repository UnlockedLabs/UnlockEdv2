package database

import (
	"UnlockEdv2/src/models"
)

func (db *DB) GetOutcomesForUser(id uint, page, perPage int, order string, orderBy string, outcomeType models.OutcomeType) (int64, []models.Outcome, error) {
	var outcomes []models.Outcome
	var count int64
	offset := (page - 1) * perPage

	fieldMap := map[string]string{
		"created_at": "created_at",
		"type":       "type",
	}
	dbField, ok := fieldMap[orderBy]
	if !ok {
		dbField = "created_at"
	}
	orderStr := dbField + " " + validOrder(order)

	query := db.Model(&models.Outcome{}).Where("user_id = ?", id)

	if outcomeType != "" {
		query = query.Where("type = ?", outcomeType)
	}

	if err := query.Count(&count).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "outcomes")
	}
	if err := query.Order(orderStr).Offset(offset).Limit(perPage).Find(&outcomes).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "outcomes")
	}
	return count, outcomes, nil
}
