package models

import (
	"fmt"
	"reflect"
	"slices"
	"time"
)

type ChangeLogEntry struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	NameTable   string    `json:"table_name" gorm:"column:table_name;size:255"`
	ParentRefID uint      `json:"parent_ref_id"`
	FieldName   string    `json:"field_name"`
	OldValue    *string   `json:"old_value"`
	NewValue    *string   `json:"new_value"`
	CreatedAt   time.Time `json:"created_at"`
	UserID      uint      `json:"user_id"`
	Username    string    `json:"username" gorm:"->"`
}

func (ChangeLogEntry) TableName() string {
	return "change_log_entries"
}

func NewChangeLogEntry(tableName, fieldName string, oldValue, newValue *string, parentRefID, userID uint) *ChangeLogEntry {
	return &ChangeLogEntry{
		NameTable:   tableName,
		ParentRefID: parentRefID,
		FieldName:   fieldName,
		OldValue:    oldValue,
		NewValue:    newValue,
		CreatedAt:   time.Now(),
		UserID:      userID,
	}
}

func GenerateChangeLogEntries(oldRecord, updRecord interface{}, tableName string, parentID uint, userID uint, ignoreFieldNames []string) []ChangeLogEntry {
	var entries []ChangeLogEntry
	oldVal := reflect.ValueOf(oldRecord).Elem()
	newVal := reflect.ValueOf(updRecord).Elem()
	kind := oldVal.Type()

	for i := 0; i < oldVal.NumField(); i++ {
		field := kind.Field(i)
		name := field.Tag.Get("json")
		if !oldVal.Field(i).CanInterface() || slices.Contains(ignoreFieldNames, name) || name == "-" || name == "" {
			continue
		}
		oldValue := fmt.Sprintf("%v", oldVal.Field(i).Interface())
		newValue := fmt.Sprintf("%v", newVal.Field(i).Interface())
		if oldValue != newValue {
			entries = append(entries, *NewChangeLogEntry(tableName, name, StringPtr(oldValue), StringPtr(newValue), parentID, userID))
		}
	}
	return entries
}
