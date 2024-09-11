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

func (db *DB) CreateOutcome(outcome *models.Outcome) (*models.Outcome, error) {
	if err := db.Create(outcome).Error; err != nil {
		return nil, newCreateDBError(err, "outcomes")
	}
	return outcome, nil
}

func (db *DB) UpdateOutcome(outcome *models.Outcome, id uint) (*models.Outcome, error) {
	toUpdate := models.Outcome{}
	if err := db.First(&toUpdate, id).Error; err != nil {
		return nil, newUpdateDBrror(err, "outcomes")
	}
	models.UpdateStruct(&toUpdate, outcome)
	if err := db.Model(&models.Outcome{}).Where("id = ?", id).Updates(&toUpdate).Error; err != nil {
		return nil, newUpdateDBrror(err, "outcomes")
	}
	return &toUpdate, nil
}

func (db *DB) DeleteOutcome(id uint) error {
	if err := db.Delete(&models.Outcome{}, id).Error; err != nil {
		return newDeleteDBError(err, "outcome")
	}
	return nil
}
