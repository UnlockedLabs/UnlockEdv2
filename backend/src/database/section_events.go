package database

import (
	"UnlockEdv2/src/models"
	"sort"
	"time"

	"github.com/teambition/rrule-go"
)

func (db *DB) GetSectionEvents(page, perPage, sectionId int) (int64, []models.SectionEvent, error) {
	content := []models.SectionEvent{}
	total := int64(0)
	if err := db.Model(&models.SectionEvent{}).Preload("Overrides").Find(&content).Count(&total).
		Limit(perPage).Offset((page - 1) * perPage).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "section_events")
	}
	return total, content, nil
}

func (db *DB) NewEventOverride(eventId int, form *models.OverrideForm) (*models.SectionEventOverride, error) {
	override := models.SectionEventOverride{
		EventID:      uint(eventId),
		StartTime:    form.StartTime,
		EndTime:      form.EndTime,
		OverrideRule: form.OverrideRule,
		IsCancelled:  form.IsCancelled,
	}
	if err := db.Create(&override).Error; err != nil {
		return nil, newCreateDBError(err, "section_event_override")
	}
	return &override, nil
}

func (db *DB) GetCalendar(month time.Month, year int, facilityId uint, userId *uint) (*models.Calendar, error) {
	content := []models.SectionEvent{}

	var tz string
	if err := db.Table("facilities f").Select("timezone").Where("id = ?", facilityId).Row().Scan(&tz); err != nil {
		return nil, newGetRecordsDBError(err, "calendar")
	}
	if userId != nil {
		// only get events which the user has a SectionEnrollment for
		if err := db.Model(&models.SectionEvent{}).
			Preload("Overrides").
			Joins("JOIN section_enrollments se ON se.section_id = section_events.section_id").
			Where("se.user_id = ?", userId).
			Find(&content).Error; err != nil {
			return nil, newGetRecordsDBError(err, "calendar")
		}
	} else {
		if err := db.Model(&models.SectionEvent{}).
			Preload("Overrides").
			Find(&content).Error; err != nil {
			return nil, newGetRecordsDBError(err, "calendar")
		}
	}

	daysMap := make(map[string]*models.Day)

	firstOfMonth := time.Date(year, month, 1, 0, 0, 0, 0, time.FixedZone(tz, 0))
	lastOfMonth := firstOfMonth.AddDate(0, 1, -1)

	currentDate := firstOfMonth
	for !currentDate.After(lastOfMonth) {
		dateStr := currentDate.Format("2006-01-02")
		daysMap[dateStr] = &models.Day{
			Date:   currentDate,
			Events: []models.EventInstance{},
		}
		currentDate = currentDate.AddDate(0, 0, 1)
	}

	for _, event := range content {
		rruleStr := event.RecurrenceRule

		rruleSet := rrule.Set{}
		dtstart, err := time.Parse(time.RFC3339, event.StartTime)
		if err != nil {
			return nil, err
		}
		rruleOptions, err := rrule.StrToROption("DTSTART:" + dtstart.Format(time.RFC3339) + "\n" + rruleStr)
		if err != nil {
			return nil, err
		}
		rruleOptions.Dtstart = dtstart

		r, err := rrule.NewRRule(*rruleOptions)
		if err != nil {
			return nil, err
		}
		rruleSet.RRule(r)

		occurrences := rruleSet.Between(firstOfMonth, lastOfMonth.AddDate(0, 0, 1), true)

		eventInstances := applyOverrides(event, occurrences)

		for _, instance := range eventInstances {
			dateStr := instance.StartTime.Format("2006-01-02")
			day, exists := daysMap[dateStr]
			if !exists {
				/* unreachable? but handle anyay */
				day = &models.Day{
					Date:   instance.StartTime.Truncate(24 * time.Hour),
					Events: []models.EventInstance{},
				}
				daysMap[dateStr] = day
			}
			day.Events = append(day.Events, instance)
		}
	}
	var days []models.Day
	for _, day := range daysMap {
		days = append(days, *day)
	}
	sort.Slice(days, func(i, j int) bool {
		return days[i].Date.Before(days[j].Date)
	})
	return models.NewCalendar(year, month.String(), days), nil
}

func applyOverrides(event models.SectionEvent, occurrences []time.Time) []models.EventInstance {
	var instances []models.EventInstance

	sort.Slice(event.Overrides, func(i, j int) bool {
		return event.Overrides[i].StartTime < event.Overrides[j].StartTime
	})

	var currentOverride *models.SectionEventOverride
	for _, occ := range occurrences {
		for _, override := range event.Overrides {
			overrideStartTime, err := time.Parse(time.RFC3339, override.StartTime)
			if err != nil {
				continue
			}
			if override.OverrideRule == models.Onwards && !occ.Before(overrideStartTime) {
				currentOverride = &override
			} else if override.OverrideRule == models.Self && occ.Equal(overrideStartTime) {
				currentOverride = &override
				break
			}
		}

		instance := models.EventInstance{
			EventID:     event.ID,
			SectionID:   event.SectionID,
			StartTime:   occ,
			EndTime:     occ.Add(parseDuration(event.StartTime, event.EndTime)),
			IsCancelled: false,
		}

		if currentOverride != nil {
			overrideStartTime, err := time.Parse(time.RFC3339, currentOverride.StartTime)
			if err == nil && occ.Equal(overrideStartTime) {
				if currentOverride.IsCancelled {
					continue
				} else {
					newStartTime, err := time.Parse(time.RFC3339, currentOverride.StartTime)
					newEndTime, err2 := time.Parse(time.RFC3339, currentOverride.EndTime)
					if err == nil && err2 == nil {
						instance.StartTime = newStartTime
						instance.EndTime = newEndTime
					}
				}
			} else if currentOverride.OverrideRule == models.Onwards && !occ.Before(overrideStartTime) {
				if currentOverride.IsCancelled {
					continue
				} else {
					duration := parseDuration(currentOverride.StartTime, currentOverride.EndTime)
					instance.StartTime = occ
					instance.EndTime = occ.Add(duration)
				}
			}
		}
		instances = append(instances, instance)
	}
	return instances
}

func generateEventInstances(event models.SectionEvent, startDate, endDate time.Time) ([]models.EventInstance, error) {
	rruleStr := event.RecurrenceRule
	dtstart, err := time.Parse(time.RFC3339, event.StartTime)
	if err != nil {
		return nil, err
	}

	rruleOptions, err := rrule.StrToROption("DTSTART:" + dtstart.Format(time.RFC3339) + "\n" + rruleStr)
	if err != nil {
		return nil, err
	}
	rruleOptions.Dtstart = dtstart

	r, err := rrule.NewRRule(*rruleOptions)
	if err != nil {
		return nil, err
	}
	occurrences := r.Between(startDate, endDate.AddDate(0, 0, 1), true)
	eventInstances := applyOverrides(event, occurrences)
	return eventInstances, nil
}

func parseDuration(startStr, endStr string) time.Duration {
	startTime, err1 := time.Parse(time.RFC3339, startStr)
	endTime, err2 := time.Parse(time.RFC3339, endStr)
	if err1 != nil || err2 != nil {
		return 0
	}
	return endTime.Sub(startTime)
}
