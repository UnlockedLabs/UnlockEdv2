package database

import (
	"UnlockEdv2/src/models"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func withFacilityName(db *DB) *gorm.DB {
	return db.Model(&models.LearningRecordEntry{}).
		Select("learning_record_entries.*, COALESCE(facilities.name, '') AS facility_name").
		Joins("LEFT JOIN facilities ON facilities.id = learning_record_entries.facility_id")
}

func (db *DB) GetLearningRecordEntries(userID uint) ([]models.LearningRecordEntry, error) {
	entries := make([]models.LearningRecordEntry, 0)
	if err := withFacilityName(db).
		Where("learning_record_entries.user_id = ? AND learning_record_entries.is_draft = false", userID).
		Order("learning_record_entries.created_at DESC").
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
		Updates(learningRecordColumns(entry))
	if result.Error != nil {
		return newUpdateDBError(result.Error, "learning_record_entries")
	}
	return nil
}

func (db *DB) DeleteLearningRecordEntry(id, userID uint) error {
	actorID := userID
	if ctx := db.Statement.Context; ctx != nil {
		if uid, ok := ctx.Value(models.UserIDKey).(uint); ok {
			actorID = uid
		}
	}
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.LearningRecordEntry{}).
			Where("id = ? AND user_id = ?", id, userID).
			Update("update_user_id", actorID).Error; err != nil {
			return newUpdateDBError(err, "learning_record_entries")
		}
		if err := tx.Where("id = ? AND user_id = ?", id, userID).
			Delete(&models.LearningRecordEntry{}).Error; err != nil {
			return newDeleteDBError(err, "learning_record_entries")
		}
		history := models.NewUserAccountHistory(userID, models.LearningRecordDeleted, &actorID, nil, nil)
		if err := tx.Create(history).Error; err != nil {
			return newCreateDBError(err, "user_account_history")
		}
		return nil
	})
}

// GetLearningRecordDraft returns the most recently updated draft for the user, or nil.
func (db *DB) GetLearningRecordDraft(userID uint) (*models.LearningRecordEntry, error) {
	var draft models.LearningRecordEntry
	err := withFacilityName(db).
		Where("learning_record_entries.user_id = ? AND learning_record_entries.is_draft = true", userID).
		Order("learning_record_entries.updated_at DESC").
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
	updateMap := learningRecordColumns(draft)
	updateMap["is_draft"] = true
	updateMap["updated_at"] = gorm.Expr("NOW()")
	if ctx := db.Statement.Context; ctx != nil {
		if userID, ok := ctx.Value(models.UserIDKey).(uint); ok {
			updateMap["update_user_id"] = userID
		}
	}
	if err := db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "client_id"}},
		DoUpdates: clause.Assignments(updateMap),
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

func learningRecordColumns(e *models.LearningRecordEntry) map[string]any {
	return map[string]any{
		"step_index": e.StepIndex, "ui_phase": e.UiPhase,
		"editing_entry_id": e.EditingEntryID, "program_name": e.ProgramName,
		"facility_id": e.FacilityID, "facility_other": e.FacilityOther,
		"completion_date": e.CompletionDate, "confidence": e.Confidence,
		"summary": e.Summary, "top_skills": e.TopSkills,
		"barrier_to_completion": e.BarrierToCompletion, "goal_connection": e.GoalConnection,
		"pride": e.Pride, "standout_moment": e.StandoutMoment,
		"advice_to_peer": e.AdviceToPeer, "challenge_toggle": e.ChallengeToggle,
		"challenge_text": e.ChallengeText, "skill_tags_before": e.SkillTagsBefore,
		"skill_tags_after": e.SkillTagsAfter, "skill_reflection": e.SkillReflection,
		"growth_reflection": e.GrowthReflection, "support_selections": e.SupportSelections,
		"next_step_selections": e.NextStepSelections,
	}
}
