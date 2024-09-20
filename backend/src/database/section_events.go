package database

import (
	"UnlockEdv2/src/models"
	"sort"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/teambition/rrule-go"
)

func (db *DB) GetSectionEvents(page, perPage, sectionId int) (int64, []models.ProgramSectionEvent, error) {
	content := []models.ProgramSectionEvent{}
	total := int64(0)
	if err := db.Model(&models.ProgramSectionEvent{}).Preload("Overrides").Find(&content).Count(&total).
		Limit(perPage).Offset((page - 1) * perPage).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "program_section_events")
	}
	return total, content, nil
}

func (db *DB) CreateNewEvent(sectionId int, form *models.ProgramSectionEvent) (*models.ProgramSectionEvent, error) {
	err := validate().Struct(form)
	if err != nil {
		return nil, newCreateDBError(err, "program_section_event")
	}
	if err := db.Create(form).Error; err != nil {
		return nil, newCreateDBError(err, "program_section_event")
	}
	return form, nil
}

func (db *DB) NewEventOverride(eventId int, form *models.OverrideForm) (*models.ProgramSectionEventOverride, error) {
	override := models.ProgramSectionEventOverride{
		EventID:       uint(eventId),
		Duration:      form.Duration,
		OverrideRRule: form.OverrideRule,
		IsCancelled:   form.IsCancelled,
	}
	if err := db.Create(&override).Error; err != nil {
		return nil, newCreateDBError(err, "program_section_event_override")
	}
	return &override, nil
}

func (db *DB) getCalendarFromEvents(events []models.ProgramSectionEvent, month time.Month, year int, tz string) (*models.Calendar, error) {
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

	for _, event := range events {
		rruleStr := event.RecurrenceRule
		rruleSet := rrule.Set{}
		rruleOptions, err := rrule.StrToROption(rruleStr)
		if err != nil {
			logrus.Errorf("Error parsing rrule: %s", err)
			return nil, err
		}
		r, err := rrule.NewRRule(*rruleOptions)
		if err != nil {
			return nil, err
		}
		rruleSet.RRule(r)

		eventInstances := generateEventInstances(event, firstOfMonth, lastOfMonth.Add(time.Duration(24*time.Hour-1)))

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
			instance.Location = event.Location
			instance.ProgramName = event.Section.Program.Name
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

func (db *DB) GetCalendar(month time.Month, year int, facilityId uint, userId *uint) (*models.Calendar, error) {
	content := []models.ProgramSectionEvent{}

	var tz string
	if err := db.Table("facilities f").Select("timezone").Where("id = ?", facilityId).Row().Scan(&tz); err != nil {
		return nil, newGetRecordsDBError(err, "calendar")
	}
	if userId != nil {
		// only get events which the user has a ProgramSectionEnrollments for
		if err := db.Model(&models.ProgramSectionEvent{}).
			Preload("Overrides").Preload("Section.Program").
			Joins("JOIN program_section_enrollments se ON se.section_id = program_section_events.section_id").
			Where("se.user_id = ?", userId).
			Find(&content).Error; err != nil {
			return nil, newGetRecordsDBError(err, "calendar")
		}
	} else {
		if err := db.Model(&models.ProgramSectionEvent{}).
			Preload("Overrides").Preload("Section.Program").
			Joins("JOIN program_sections ps ON ps.id = program_section_events.section_id").
			Find(&content, "ps.facility_id = ? ", facilityId).Error; err != nil {
			return nil, newGetRecordsDBError(err, "calendar")
		}
	}
	return db.getCalendarFromEvents(content, month, year, tz)
}

func applyOverrides(event models.ProgramSectionEvent, start, end time.Time) []models.EventInstance {
	var instances []models.EventInstance
	mainSet := rrule.Set{}

	duration, err := time.ParseDuration(event.Duration)
	if err != nil {
		logrus.Errorf("Error parsing duration: %s", err)
		duration = time.Duration(1 * time.Hour) // shouldn't happen
	}
	mainRuleOptions, err := rrule.StrToROption(event.RecurrenceRule)
	if err != nil {
		logrus.Errorf("Error parsing main event RRULE: %s", err)
		return instances
	}
	mainRule, err := rrule.NewRRule(*mainRuleOptions)
	if err != nil {
		logrus.Errorf("Error creating main RRULE: %s", err)
		return instances
	}
	mainSet.RRule(mainRule)

	var rDates []models.EventInstance

	for _, override := range event.Overrides {
		overrideOptions, err := rrule.StrToROption(override.OverrideRRule)
		if err != nil {
			logrus.Errorf("Error parsing override RRULE: %s", err)
			continue
		}
		overrideRule, err := rrule.NewRRule(*overrideOptions)
		if err != nil {
			logrus.Errorf("Error creating override RRULE: %s", err)
			continue
		}
		overrideOccurrences := overrideRule.Between(start, end, true)
		if override.IsCancelled {
			for _, occ := range overrideOccurrences {
				mainSet.ExDate(occ)
			}
		} else {
			for _, occ := range overrideOccurrences {
				rDateInstance := models.EventInstance{
					EventID:     event.ID,
					SectionID:   event.SectionID,
					Duration:    duration,
					StartTime:   occ,
					IsCancelled: false,
				}
				if override.Duration != "" {
					newDuration, err := time.ParseDuration(override.Duration)
					if err == nil {
						rDateInstance.Duration = newDuration
					}
				}
				rDates = append(rDates, rDateInstance)
				mainSet.ExDate(occ)
			}
		}
	}
	occurrences := mainSet.Between(start, end, true)

	for _, occ := range occurrences {
		instance := models.EventInstance{
			EventID:     event.ID,
			SectionID:   event.SectionID,
			StartTime:   occ,
			Duration:    duration,
			IsCancelled: false,
		}
		instances = append(instances, instance)
	}

	instances = append(instances, rDates...)
	sort.Slice(instances, func(i, j int) bool {
		return instances[i].StartTime.Before(instances[j].StartTime)
	})

	return instances
}

func generateEventInstances(event models.ProgramSectionEvent, startDate, endDate time.Time) []models.EventInstance {
	eventInstances := applyOverrides(event, startDate, endDate)
	return eventInstances
}
