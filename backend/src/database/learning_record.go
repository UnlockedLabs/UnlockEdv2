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

/*
GetLearningRecordLocationFacility resolves a facility id used as an achievement
location, returning the facility's name and whether it exists at all. The lookup
is unscoped on purpose: an achievement can point at a facility that has since
been soft-deleted, and the foreign key still holds, so rejecting those would
block edits to older records. ok is false only for an id that is not a facility.
*/
func (db *DB) GetLearningRecordLocationFacility(id uint) (string, bool, error) {
	var names []string
	if err := db.Unscoped().Model(&models.Facility{}).
		Where("id = ?", id).
		Limit(1).
		Pluck("name", &names).Error; err != nil {
		return "", false, newGetRecordsDBError(err, "facilities")
	}
	if len(names) == 0 {
		return "", false, nil
	}
	return names[0], true, nil
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
		Updates(learningRecordEntryColumns(entry))
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

// learningRecordEntryColumns holds the achievement fields shared by drafts and
// committed entries. The draft-only wizard state (step_index, ui_phase,
// editing_entry_id) is excluded so editing a committed entry cannot reset it.
func learningRecordEntryColumns(e *models.LearningRecordEntry) map[string]any {
	return map[string]any{
		"program_name": e.ProgramName,
		"facility_id":  e.FacilityID, "facility_other": e.FacilityOther,
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

// learningRecordColumns adds the draft-only wizard state to the shared
// achievement fields; use it for draft upserts only.
func learningRecordColumns(e *models.LearningRecordEntry) map[string]any {
	columns := learningRecordEntryColumns(e)
	columns["step_index"] = e.StepIndex
	columns["ui_phase"] = e.UiPhase
	columns["editing_entry_id"] = e.EditingEntryID
	return columns
}
