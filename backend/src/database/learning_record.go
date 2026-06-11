package database

import (
	"UnlockEdv2/src/models"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func (db *DB) GetLearningRecordEntries(userID uint) ([]models.LearningRecordEntry, error) {
	entries := make([]models.LearningRecordEntry, 0)
	if err := db.Where("user_id = ? AND is_draft = false", userID).
		Order("created_at DESC").
		Find(&entries).Error; err != nil {
		return nil, newGetRecordsDBError(err, "learning_record_entries")
	}
	return entries, nil
}

func (db *DB) CreateLearningRecordEntry(entry *models.LearningRecordEntry) error {
	if err := db.Create(entry).Error; err != nil {
		return newCreateDBError(err, "learning_record_entries")
	}
	return nil
}

func (db *DB) UpdateLearningRecordEntry(entry *models.LearningRecordEntry) error {
	result := db.Model(entry).
		Where("id = ? AND user_id = ?", entry.ID, entry.UserID).
		Updates(entry)
	if result.Error != nil {
		return newUpdateDBError(result.Error, "learning_record_entries")
	}
	return nil
}

func (db *DB) DeleteLearningRecordEntry(id, userID uint) error {
	if err := db.Where("id = ? AND user_id = ?", id, userID).
		Delete(&models.LearningRecordEntry{}).Error; err != nil {
		return newDeleteDBError(err, "learning_record_entries")
	}
	return nil
}

// GetLearningRecordDraft returns the most recently updated draft for the user, or nil.
func (db *DB) GetLearningRecordDraft(userID uint) (*models.LearningRecordEntry, error) {
	var draft models.LearningRecordEntry
	err := db.Where("user_id = ? AND is_draft = true", userID).
		Order("updated_at DESC").
		First(&draft).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, newGetRecordsDBError(err, "learning_record_entries")
	}
	return &draft, nil
}

// UpsertLearningRecordDraft inserts or updates a draft row keyed on (user_id, client_id).
func (db *DB) UpsertLearningRecordDraft(draft *models.LearningRecordEntry) error {
	draft.IsDraft = true
	if err := db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}, {Name: "client_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"is_draft", "step_index", "ui_phase", "editing_entry_id",
			"program_name", "completion_date", "confidence", "summary",
			"top_skills", "barrier_to_completion", "goal_connection",
			"pride", "standout_moment", "advice_to_peer",
			"challenge_toggle", "challenge_text",
			"skill_tags_before", "skill_tags_after", "skill_reflection",
			"growth_reflection", "support_selections", "next_step_selections",
			"updated_at",
		}),
	}).Create(draft).Error; err != nil {
		return newCreateDBError(err, "learning_record_entries")
	}
	return nil
}

func (db *DB) DeleteLearningRecordDraft(userID uint, clientID string) error {
	if err := db.Where("user_id = ? AND client_id = ? AND is_draft = true", userID, clientID).
		Delete(&models.LearningRecordEntry{}).Error; err != nil {
		return newDeleteDBError(err, "learning_record_entries")
	}
	return nil
}
