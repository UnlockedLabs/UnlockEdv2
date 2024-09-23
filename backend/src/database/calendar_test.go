package database

import (
	"UnlockEdv2/src/models"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/teambition/rrule-go"
)

func TestGenerateEventInstances_SimpleRecurrence_NoOverrides(t *testing.T) {
	rule, err := rrule.NewRRule(rrule.ROption{
		Freq:    rrule.WEEKLY,
		Count:   5,
		Dtstart: time.Date(2024, 9, 2, 10, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatal("failed to create rrule", err)
	}
	event := models.ProgramSectionEvent{
		SectionID:      100,
		Duration:       time.Hour.String(),
		RecurrenceRule: rule.String(),
		Overrides:      []models.ProgramSectionEventOverride{},
	}

	startDate := time.Date(2024, 9, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(2024, 9, 30, 23, 59, 59, 0, time.UTC)

	instances := generateEventInstances(event, startDate, endDate)

	expectedDates := []time.Time{
		time.Date(2024, 9, 2, 10, 0, 0, 0, time.UTC),
		time.Date(2024, 9, 9, 10, 0, 0, 0, time.UTC),
		time.Date(2024, 9, 16, 10, 0, 0, 0, time.UTC),
		time.Date(2024, 9, 23, 10, 0, 0, 0, time.UTC),
		time.Date(2024, 9, 30, 10, 0, 0, 0, time.UTC),
	}

	assert.Len(t, instances, len(expectedDates), "Should generate 5 instances")

	for i, instance := range instances {
		assert.Equal(t, event.ID, instance.EventID, "EventID should match")
		assert.Equal(t, event.SectionID, instance.SectionID, "SectionID should match")
		assert.Equal(t, expectedDates[i], instance.StartTime, "StartTime should match")
		assert.Equal(t, event.Duration, instance.Duration.String(), "Duration should match")
		assert.False(t, instance.IsCancelled, "IsCancelled should be false")
	}
}

func TestGenerateEventInstances_CancellationOverride(t *testing.T) {
	event := models.ProgramSectionEvent{
		SectionID: 200,
		Duration:  time.Hour.String(),
		RecurrenceRule: "DTSTART:20240901T090000Z\n" +
			"RRULE:FREQ=DAILY;COUNT=7",
		Overrides: []models.ProgramSectionEventOverride{
			{
				EventID:       2,
				OverrideRrule: "DTSTART:20240904T090000Z\nRRULE:FREQ=DAILY;COUNT=1",
				IsCancelled:   true,
			},
		},
	}

	startDate := time.Date(2024, 9, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(2024, 9, 7, 23, 59, 59, 0, time.UTC)

	instances := generateEventInstances(event, startDate, endDate)

	expectedDates := []time.Time{
		time.Date(2024, 9, 1, 9, 0, 0, 0, time.UTC),
		time.Date(2024, 9, 2, 9, 0, 0, 0, time.UTC),
		time.Date(2024, 9, 3, 9, 0, 0, 0, time.UTC),
		// Skipping September 4 due to cancellation
		time.Date(2024, 9, 5, 9, 0, 0, 0, time.UTC),
		time.Date(2024, 9, 6, 9, 0, 0, 0, time.UTC),
		time.Date(2024, 9, 7, 9, 0, 0, 0, time.UTC),
	}

	assert.Len(t, instances, len(expectedDates), "Should generate 6 instances after cancellation")

	for i, instance := range instances {
		assert.Equal(t, event.ID, instance.EventID, "EventID should match")
		assert.Equal(t, expectedDates[i], instance.StartTime, "StartTime should match")
		assert.False(t, instance.IsCancelled, "IsCancelled should be false")
	}
}

func TestGenerateEventInstances_ModificationOverride(t *testing.T) {
	newDuration := 90 * time.Minute
	rule, err := rrule.NewRRule(rrule.ROption{
		Dtstart:   time.Date(2024, 9, 1, 10, 0, 0, 0, time.UTC),
		Freq:      rrule.WEEKLY,
		Count:     4,
		Byweekday: []rrule.Weekday{rrule.SU},
	})
	if err != nil {
		t.Fatalf("failed to create rrule: %v", err)
	}
	overRule, err := rrule.NewRRule(rrule.ROption{
		Dtstart:   time.Date(2024, 9, 15, 10, 0, 0, 0, time.UTC),
		Freq:      rrule.WEEKLY,
		Byweekday: []rrule.Weekday{rrule.SU},
	})
	if err != nil {
		t.Fatalf("failed to create rrule: %v", err)
	}
	event := models.ProgramSectionEvent{
		SectionID:      300,
		Duration:       time.Hour.String(),
		RecurrenceRule: rule.String(),
		Overrides: []models.ProgramSectionEventOverride{
			{
				EventID:       3,
				OverrideRrule: overRule.String(),
				IsCancelled:   false,
				Duration:      newDuration.String(),
			},
		},
	}

	startDate := time.Date(2024, 9, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(2024, 9, 28, 23, 59, 59, 0, time.UTC)

	instances := generateEventInstances(event, startDate, endDate)

	expectedInstances := []models.EventInstance{
		{
			EventID:     event.ID,
			StartTime:   time.Date(2024, 9, 1, 10, 0, 0, 0, time.UTC),
			Duration:    time.Duration(1 * time.Hour),
			IsCancelled: false,
		},
		{
			EventID:     event.ID,
			StartTime:   time.Date(2024, 9, 8, 10, 0, 0, 0, time.UTC),
			Duration:    time.Duration(1 * time.Hour),
			IsCancelled: false,
		},
		{
			EventID:     event.ID,
			StartTime:   time.Date(2024, 9, 15, 10, 0, 0, 0, time.UTC),
			Duration:    newDuration,
			IsCancelled: false,
		},
		{
			EventID:     event.ID,
			StartTime:   time.Date(2024, 9, 22, 10, 0, 0, 0, time.UTC),
			Duration:    newDuration,
			IsCancelled: false,
		},
	}

	assert.Len(t, instances, len(expectedInstances), "Should generate 4 instances with modified duration from September 15")

	for i, instance := range instances {
		expected := expectedInstances[i]
		assert.Equal(t, expected.EventID, instance.EventID, "EventID should match")
		assert.Equal(t, expected.StartTime, instance.StartTime, "StartTime should match")
		assert.Equal(t, expected.Duration, instance.Duration, "Duration should match")
		assert.False(t, instance.IsCancelled, "IsCancelled should be false")
	}
}

func TestGenerateEventInstances_MultipleOverrides(t *testing.T) {
	newDuration := 2 * time.Hour
	rule, err := rrule.NewRRule(rrule.ROption{
		Dtstart: time.Date(2024, 9, 1, 8, 0, 0, 0, time.UTC),
		Freq:    rrule.DAILY,
		Count:   7,
	})
	if err != nil {
		t.Fatal("failed to create rrule", err)
	}

	rule1, err := rrule.NewRRule(rrule.ROption{
		Dtstart: time.Date(2024, 9, 3, 8, 0, 0, 0, time.UTC),
		Freq:    rrule.DAILY,
		Count:   1,
	})
	if err != nil {
		t.Fatal("failed to create rrule", err)
	}
	override1 := models.ProgramSectionEventOverride{
		EventID:       4,
		OverrideRrule: rule1.String(),
		IsCancelled:   true,
	}

	rule2, err := rrule.NewRRule(rrule.ROption{
		Dtstart: time.Date(2024, 9, 5, 8, 0, 0, 0, time.UTC),
		Freq:    rrule.DAILY,
		Until:   time.Date(2024, 9, 7, 8, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatal("failed to create rrule", err)
	}
	override2 := models.ProgramSectionEventOverride{
		EventID:       4,
		IsCancelled:   false,
		Duration:      newDuration.String(),
		OverrideRrule: rule2.String(),
	}
	event := models.ProgramSectionEvent{
		SectionID:      400,
		Duration:       time.Hour.String(),
		RecurrenceRule: rule.String(),
		Overrides:      []models.ProgramSectionEventOverride{override1, override2},
	}
	startDate := time.Date(2024, 9, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(2024, 9, 7, 23, 59, 59, 0, time.UTC)
	instances := generateEventInstances(event, startDate, endDate)

	expectedInstances := []models.EventInstance{
		{
			EventID:     event.ID,
			StartTime:   time.Date(2024, 9, 1, 8, 0, 0, 0, time.UTC),
			Duration:    time.Duration(1 * time.Hour),
			IsCancelled: false,
		},
		{
			EventID:     event.ID,
			StartTime:   time.Date(2024, 9, 2, 8, 0, 0, 0, time.UTC),
			Duration:    time.Duration(1 * time.Hour),
			IsCancelled: false,
		},
		// Skipping September 3 due to cancellation
		{
			EventID:     event.ID,
			StartTime:   time.Date(2024, 9, 4, 8, 0, 0, 0, time.UTC),
			Duration:    time.Duration(1 * time.Hour),
			IsCancelled: false,
		},
		{
			EventID:     event.ID,
			StartTime:   time.Date(2024, 9, 5, 8, 0, 0, 0, time.UTC),
			Duration:    newDuration,
			IsCancelled: false,
		},
		{
			EventID:     event.ID,
			StartTime:   time.Date(2024, 9, 6, 8, 0, 0, 0, time.UTC),
			Duration:    newDuration,
			IsCancelled: false,
		},
		{
			EventID:     event.ID,
			StartTime:   time.Date(2024, 9, 7, 8, 0, 0, 0, time.UTC),
			Duration:    newDuration, // Modified duration
			IsCancelled: false,
		},
	}

	assert.Len(t, instances, len(expectedInstances), "Should generate 6 instances with cancellations and modifications")

	for i, instance := range instances {
		expected := expectedInstances[i]
		assert.Equal(t, expected.EventID, instance.EventID, "EventID should match")
		assert.Equal(t, expected.StartTime, instance.StartTime, "StartTime should match")
		assert.Equal(t, expected.Duration, instance.Duration, "Duration should match")
		assert.False(t, instance.IsCancelled, "IsCancelled should be false")
	}
}

func TestGenerateEventInstances_NoOccurrencesInRange(t *testing.T) {
	rule, err := rrule.NewRRule(rrule.ROption{
		Dtstart: time.Date(2024, 10, 1, 8, 0, 0, 0, time.UTC),
		Freq:    rrule.DAILY,
		Count:   5,
	})
	if err != nil {
		t.Fatal("failed to create rrule", err)
	}
	event := models.ProgramSectionEvent{
		SectionID:      500,
		Duration:       time.Hour.String(),
		RecurrenceRule: rule.String(),
		Overrides:      []models.ProgramSectionEventOverride{},
	}

	startDate := time.Date(2024, 9, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(2024, 9, 30, 23, 59, 59, 0, time.UTC)

	instances := generateEventInstances(event, startDate, endDate)
	assert.Len(t, instances, 0, "Should generate no instances as event occurs outside the date range")
}

func TestGenerateEventInstances_InvalidRRULE(t *testing.T) {
	event := models.ProgramSectionEvent{
		SectionID:      600,
		Duration:       time.Hour.String(),
		RecurrenceRule: "INVALID_RRULE",
		Overrides:      []models.ProgramSectionEventOverride{},
	}

	startDate := time.Date(2024, 9, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(2024, 9, 30, 23, 59, 59, 0, time.UTC)
	instances := generateEventInstances(event, startDate, endDate)
	assert.Len(t, instances, 0, "Instances should be nil when an error occurs")
}
