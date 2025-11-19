package models

import "time"

type ConflictDetail struct {
	UserID           uint      `json:"user_id"`
	UserName         string    `json:"user_name"`
	ConflictingClass string    `json:"conflicting_class"`
	ConflictStart    time.Time `json:"conflict_start"`
	ConflictEnd      time.Time `json:"conflict_end"`
	Reason           string    `json:"reason"`
}
