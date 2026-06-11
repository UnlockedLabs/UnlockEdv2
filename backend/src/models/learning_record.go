package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

// StringSlice persists a Go string slice as a JSON text column.
type StringSlice []string

func (s StringSlice) Value() (driver.Value, error) {
	if s == nil {
		return "[]", nil
	}
	b, err := json.Marshal(s)
	return string(b), err
}

func (s *StringSlice) Scan(value any) error {
	var raw string
	switch v := value.(type) {
	case string:
		raw = v
	case []byte:
		raw = string(v)
	default:
		raw = "[]"
	}
	return json.Unmarshal([]byte(raw), s)
}

type LearningRecordEntry struct {
	ID                  uint        `gorm:"primaryKey"        json:"id"`
	UserID              uint        `gorm:"not null"          json:"user_id"`
	ClientID            string      `gorm:"not null"          json:"client_id"`
	IsDraft             bool        `gorm:"not null;default:false" json:"is_draft"`
	StepIndex           int         `                         json:"step_index"`
	UiPhase             string      `                         json:"ui_phase"`
	EditingEntryID      *uint       `                         json:"editing_entry_id"`
	ProgramName         string      `                         json:"program_name"`
	CompletionDate      string      `                         json:"completion_date"`
	Confidence          string      `                         json:"confidence"`
	Summary             string      `                         json:"summary"`
	TopSkills           StringSlice `gorm:"type:text"         json:"top_skills"`
	BarrierToCompletion string      `                         json:"barrier_to_completion"`
	GoalConnection      string      `                         json:"goal_connection"`
	Pride               string      `                         json:"pride"`
	StandoutMoment      string      `                         json:"standout_moment"`
	AdviceToPeer        string      `                         json:"advice_to_peer"`
	ChallengeToggle     *string     `                         json:"challenge_toggle"`
	ChallengeText       string      `                         json:"challenge_text"`
	SkillTagsBefore     StringSlice `gorm:"type:text"         json:"skill_tags_before"`
	SkillTagsAfter      StringSlice `gorm:"type:text"         json:"skill_tags_after"`
	SkillReflection     string      `                         json:"skill_reflection"`
	GrowthReflection    string      `                         json:"growth_reflection"`
	SupportSelections   StringSlice `gorm:"type:text"         json:"support_selections"`
	NextStepSelections  StringSlice `gorm:"type:text"         json:"next_step_selections"`
	CreatedAt           time.Time   `                         json:"created_at"`
	UpdatedAt           time.Time   `                         json:"updated_at"`
}

func (LearningRecordEntry) TableName() string { return "learning_record_entries" }
