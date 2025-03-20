package models

import "time"

const (
	Onwards string = "onwards"
	Self    string = "self"
	All     string = "all"
)

type Calendar struct {
	Month Month `json:"month"`
	Year  int   `json:"year"`
}

func NewCalendar(year int, month string, events []Day) *Calendar {
	return &Calendar{
		Month: Month{
			Name: month,
			Days: events,
		},
		Year: year,
	}
}

type Month struct {
	Name string `json:"name"`
	Days []Day  `json:"days"`
}

type EventInstance struct {
	EventID     uint          `json:"event_id"`
	SectionID   uint          `json:"section_id"`
	ProgramName string        `json:"program_name"`
	StartTime   time.Time     `json:"start_time"`
	Duration    time.Duration `json:"duration"`
	Room        string        `json:"location"`
	IsCancelled bool          `json:"is_cancelled"`
}

type Day struct {
	Date   time.Time       `json:"date"`
	Events []EventInstance `json:"events"`
}

type OverrideForm struct {
	Location     string `json:"location"`
	Date         string `json:"date"`
	StartTime    string `json:"start_time"`
	Duration     string `json:"duration"`
	IsCancelled  bool   `json:"is_cancelled"`
	OverrideType string `json:"override_type"`
}

const (
	OverrideAll      string = "all"
	OverrideForwards string = "forwards"
	OverrideSelf     string = "self"
)
