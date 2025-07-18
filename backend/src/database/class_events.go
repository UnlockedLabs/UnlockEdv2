package database

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/models"
	"cmp"
	"slices"
	"sort"
	"strconv"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/teambition/rrule-go"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

/*
Everything stored in database will ALWAYS be in UTC
and converted when returning to the client
*/

func (db *DB) GetClassEvents(args *models.QueryContext, classId int) ([]models.ProgramClassEvent, error) {
	events := []models.ProgramClassEvent{}
	tx := db.Model(&models.ProgramClassEvent{}).Preload("Overrides").Where("class_id = ?", classId)
	if !args.All {
		if err := tx.Count(&args.Total).Error; err != nil {
			return nil, newGetRecordsDBError(err, "program_class_events")
		}
		tx = tx.Limit(args.PerPage).Offset(args.CalcOffset())
	}
	if err := tx.Find(&events).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_events")
	}
	return events, nil
}

func (db *DB) CreateNewEvent(classId int, form *models.ProgramClassEvent) (*models.ProgramClassEvent, error) {
	err := Validate().Struct(form)
	if err != nil {
		return nil, newCreateDBError(err, "program_class_event")
	}
	if err := db.Create(form).Error; err != nil {
		return nil, newCreateDBError(err, "program_class_event")
	}
	return form, nil
}

func (db *DB) GetEventById(eventId int) (*models.ProgramClassEvent, error) {
	event := models.ProgramClassEvent{}
	if err := db.Preload("Overrides").First(&event, eventId).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_event")
	}
	return &event, nil
}

func (db *DB) CreateRescheduleEventSeries(ctx *models.QueryContext, events []models.ProgramClassEvent) error {
	tx := db.WithContext(ctx.Ctx).Begin()
	if tx.Error != nil {
		return NewDBError(tx.Error, "unable to start the database transaction")
	}

	var changeLogEntry *models.ChangeLogEntry
	for _, event := range events {
		if event.ID == 0 {
			changeLogEntry = models.NewChangeLogEntry("program_classes", "event_rescheduled_series", models.StringPtr(""), &event.RecurrenceRule, event.ClassID, ctx.UserID)
			if err := tx.Create(&event).Error; err != nil {
				tx.Rollback()
				return newCreateDBError(err, "program_class_events")
			}
		} else {
			if err := tx.Model(&models.ProgramClassEvent{}).Where("id = ?", event.ID).Update("recurrence_rule", event.RecurrenceRule).Error; err != nil {
				tx.Rollback()
				return newUpdateDBError(err, "program_class_events")
			}
		}
	}

	if err := tx.Create(&changeLogEntry).Error; err != nil {
		tx.Rollback()
		return newCreateDBError(err, "change_log_entries")
	}
	if err := tx.Commit().Error; err != nil {
		return NewDBError(err, "unable to commit the database transaction")
	}
	return nil
}

// Soft deletes ProgramClassEventOverride by its ID, removes any associated attendance records, and logs the change.
// If the ProgramClassEventOverride to be deleted has an exiting LinkedOverrideEventID (rescheduled event) that ProgramClassEventOverride is deleted
func (db *DB) DeleteOverrideEvent(args *models.QueryContext, eventID int, classID int) error {
	trans := db.WithContext(args.Ctx).Begin()
	if trans.Error != nil {
		return NewDBError(trans.Error, "unable to start the database transaction")
	}

	var (
		changeLogEntry *models.ChangeLogEntry
		eventDate      *string
		eventIDs       = make([]uint, 0, 1)
		override       models.ProgramClassEventOverride
		err            error
	)

	if err := trans.Model(&models.ProgramClassEventOverride{}).Where("id = ?", eventID).Find(&override).Error; err != nil {
		trans.Rollback()
		return newGetRecordsDBError(err, "program_class_event_overrides")
	}

	eventIDs = append(eventIDs, override.ID)
	if override.LinkedOverrideEventID != nil {
		eventIDs = append(eventIDs, *override.LinkedOverrideEventID)
	}

	eventDate, err = override.GetFormattedOverrideDate("2006-01-02")
	if err != nil {
		trans.Rollback()
		return NewDBError(err, "unable to parse override date")
	}

	if err := deleteEventAttedanceByDate(trans, override.EventID, *eventDate); err != nil {
		trans.Rollback()
		return err
	}

	if err := trans.Delete(&models.ProgramClassEventOverride{}, "id IN (?)", eventIDs).Error; err != nil {
		trans.Rollback()
		return newDeleteDBError(err, "program class event override")
	}

	changeLogEntry = models.NewChangeLogEntry("program_classes", "event_restored", &override.OverrideRrule, models.StringPtr(""), uint(classID), args.UserID)
	if err := trans.Create(&changeLogEntry).Error; err != nil {
		trans.Rollback()
		return newCreateDBError(err, "change_log_entries")
	}

	if err := trans.Commit().Error; err != nil {
		return NewDBError(err, "unable to commit the database transaction")
	}
	return nil
}

// Creates multiple ProgramClassEventOverride records within a single database transaction. It performs the following operations based upon conditions:
// - Cancels an event
// - Links two override events together for rescheduling purposes.
// - Deletes attendance records for events that have been rescheduled or cancelled.
// - Logs a single change
func (db *DB) CreateOverrideEvents(ctx *models.QueryContext, overrideEvents []*models.ProgramClassEventOverride) error {
	trans := db.WithContext(ctx.Ctx).Begin() //only need to pass context here, it will be used/shared within the transaction
	if trans.Error != nil {
		return NewDBError(trans.Error, "unable to start the database transaction")
	}

	var (
		changeLogEntry   *models.ChangeLogEntry
		eventDate        *string
		err              error
		linkedOverrideID *uint
		isOverrideUpdate bool
	)

	changeLogEntry = models.NewChangeLogEntry("program_classes", "", nil, nil, 0, ctx.UserID)
	for _, overrideEvent := range overrideEvents {
		if !overrideEvent.IsCancelled && linkedOverrideID != nil {
			overrideEvent.LinkedOverrideEventID = linkedOverrideID
		}
		isOverrideUpdate = overrideEvent.ID > 0
		if err := trans.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"duration", "override_rrule", "is_cancelled", "room", "reason", "linked_override_event_id"}),
		}).Create(&overrideEvent).Error; err != nil {
			trans.Rollback()
			return newCreateDBError(err, "program_class_event_overrides")
		}
		if overrideEvent.IsCancelled && len(overrideEvents) < 2 { //only add log for cancelled event
			if err != nil {
				trans.Rollback()
				return NewDBError(err, "unable to parse override date")
			}
			changeLogEntry.FieldName = "event_cancelled"
			changeLogEntry.OldValue = models.StringPtr("")
			changeLogEntry.ParentRefID = overrideEvent.ClassID
			changeLogEntry.NewValue = &overrideEvent.OverrideRrule
		} else if !overrideEvent.IsCancelled && len(overrideEvents) > 1 {
			eventSummary, err := overrideEvent.GetRescheduleSummary(ctx.Timezone)
			if err != nil {
				trans.Rollback()
				return NewDBError(err, "unable to parse event summary")
			}
			changeLogEntry.FieldName = "event_rescheduled"
			changeLogEntry.ParentRefID = overrideEvent.ClassID
			changeLogEntry.NewValue = eventSummary
		} else if overrideEvent.IsCancelled { //not logging the cancelled one from rescheduling action
			linkedOverrideID = &overrideEvent.ID
			if err != nil {
				trans.Rollback()
				return NewDBError(err, "unable to parse override date")
			}
			changeLogEntry.OldValue = &overrideEvent.OverrideRrule
		}
		if overrideEvent.IsCancelled || isOverrideUpdate { //delete attendance
			eventDate, err = overrideEvent.GetFormattedOverrideDate("2006-01-02")
			if err := deleteEventAttedanceByDate(trans, overrideEvent.EventID, *eventDate); err != nil {
				trans.Rollback()
				return err
			}
		}
	}

	if err := trans.Create(&changeLogEntry).Error; err != nil {
		trans.Rollback()
		return newCreateDBError(err, "change_log_entries")
	}

	//end transaction
	if err := trans.Commit().Error; err != nil {
		return NewDBError(err, "unable to commit the database transaction")
	}
	return nil
}

func deleteEventAttedanceByDate(trans *gorm.DB, eventID uint, eventDate string) error {
	if err := trans.Unscoped().Where("event_id = ? AND date = ?", eventID, eventDate).Delete(&models.ProgramClassEventAttendance{}).Error; err != nil {
		return newDeleteDBError(err, "class_event_attendance")
	}
	return nil
}

func (db *DB) NewEventOverride(eventId int, form *models.OverrideForm) (*models.ProgramClassEventOverride, error) {
	event, err := db.GetEventById(eventId)
	if err != nil {
		return nil, newGetRecordsDBError(err, "program_class_event")
	}
	override := models.ProgramClassEventOverride{
		EventID: uint(eventId),
	}
	if form.Room != "" {
		override.Room = form.Room
	}
	if form.Duration != "" {
		override.Duration = form.Duration
	}
	if form.IsCancelled {
		override.IsCancelled = true
	}
	var rruleStr string
	switch form.OverrideType {
	case models.OverrideAll:
		if form.IsCancelled {
			rruleOptions := rrule.ROption{
				Freq:    rrule.DAILY,
				Count:   0, // No occurrences
				Dtstart: time.Now(),
			}
			rule, err := rrule.NewRRule(rruleOptions)
			if err != nil {
				return nil, newCreateDBError(err, "program_class_event_override")
			}
			rruleStr = rule.String()
		} else {
			until, err := event.RRuleUntil()
			if err != nil {
				return nil, newGetRecordsDBError(err, "program_class_event")
			}
			rruleOptions := rrule.ROption{
				Freq:      rrule.WEEKLY,
				Dtstart:   time.Now(),
				Until:     until,
				Byweekday: []rrule.Weekday{rrule.MO, rrule.TU, rrule.WE, rrule.TH, rrule.FR, rrule.SA, rrule.SU}, // Modify as needed
			}
			rule, err := rrule.NewRRule(rruleOptions)
			if err != nil {
				return nil, newCreateDBError(err, "program_class_event_override")
			}
			rruleStr = rule.String()
		}
	case models.OverrideSelf:
		overrideDateOnly, err := time.ParseInLocation("2006-01-02", form.Date, time.UTC)
		if err != nil {
			return nil, newCreateDBError(err, "program_class_event_override")
		}

		eventRule, err := event.GetRRule()
		if err != nil {
			return nil, newCreateDBError(err, "program_class_event")
		}
		eventDtstartUTC := eventRule.OrigOptions.Dtstart.In(time.UTC)

		overrideDate := time.Date(
			overrideDateOnly.Year(), overrideDateOnly.Month(), overrideDateOnly.Day(),
			eventDtstartUTC.Hour(), eventDtstartUTC.Minute(), eventDtstartUTC.Second(), eventDtstartUTC.Nanosecond(),
			time.UTC,
		)

		rruleOptions := rrule.ROption{
			Freq:    rrule.DAILY,
			Count:   1,
			Dtstart: overrideDate,
		}
		rule, err := rrule.NewRRule(rruleOptions)
		if err != nil {
			return nil, newCreateDBError(err, "program_class_event_override")
		}
		rruleStr = rule.String()

	case models.OverrideForwards:
		overrideDate, err := time.Parse("2006-01-02", form.Date)
		if err != nil {
			return nil, newCreateDBError(err, "program_class_event_override")
		}
		rule, err := event.GetRRule()
		if err != nil {
			return nil, newCreateDBError(err, "program_class_event_override")
		}
		rruleOptions := rrule.ROption{
			Freq:    rule.Options.Freq,
			Dtstart: overrideDate,
			Until:   rule.Options.Until,
		}
		rule, err = rrule.NewRRule(rruleOptions)
		if err != nil {
			return nil, newCreateDBError(err, "program_class_event_override")
		}
		rruleStr = rule.String()
	default:
		return nil, newCreateDBError(err, "program_class_event_override")
	}
	override.OverrideRrule = rruleStr
	if err := db.Create(&override).Error; err != nil {
		return nil, newCreateDBError(err, "program_class_event_override")
	}
	return &override, nil
}

func (db *DB) GetFacilityCalendar(args *models.QueryContext, dtRng *models.DateRange, classID int) ([]models.FacilityProgramClassEvent, error) {
	events := make([]models.FacilityProgramClassEvent, 0, 10)
	// TO DO: finish adding overrides as is_cancelled (so it renders in the frontend)
	tx := db.WithContext(args.Ctx).Table("program_class_events pcev").
		Select(`pcev.*,
		p.name as program_name,
		c.instructor_name,
		c.name as class_name,
        STRING_AGG(CONCAT(u.id, ':', u.name_last, ', ', u.name_first), '|' ORDER BY u.name_last) FILTER (WHERE e.enrollment_status = 'Enrolled') AS enrolled_users`).
		Joins("JOIN program_classes c ON c.id = pcev.class_id and c.archived_at IS NULL").
		Joins("JOIN programs p ON p.id = c.program_id").
		Joins("LEFT JOIN program_class_enrollments e ON e.class_id = c.id").
		Joins("LEFT JOIN users u ON e.user_id = u.id").
		Where("c.facility_id = ?", args.FacilityID)

	if classID > 0 {
		tx = tx.Where("c.id = ?", classID)
	}
	if !args.IsAdmin {
		tx = tx.Where("u.id = ? AND e.enrollment_status = 'Enrolled'", args.UserID)
	}
	tx = tx.Group("pcev.id, c.instructor_name, c.name, p.name")
	if err := tx.Scan(&events).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_events")
	}

	eventIDs := make([]uint, 0, len(events))
	for _, event := range events { //gathering all for next query
		eventIDs = append(eventIDs, event.ID)
	}

	overrideEvents, err := db.GetProgramClassEventOverrides(args, eventIDs...)
	if err != nil {
		return nil, err
	}

	overrideEventMap := make(map[uint][]models.ProgramClassEventOverride)
	for _, overrideEvent := range overrideEvents { //easy organization
		overrideEventMap[overrideEvent.EventID] = append(overrideEventMap[overrideEvent.EventID], overrideEvent)
	}

	facilityEvents := make([]models.FacilityProgramClassEvent, 0, 10)
	for _, event := range events {
		rRule, err := event.GetRRule()
		if err != nil {
			return nil, err
		}
		occurrences := rRule.Between(dtRng.Start.In(dtRng.Tzone), dtRng.End.In(dtRng.Tzone), true)
		duration, err := time.ParseDuration(event.Duration)
		if err != nil {
			return nil, err
		}

		overrides := overrideEventMap[event.ID]
		var (
			isCancelled, isRescheduled bool
			overrideID                 uint
		)
		for _, occurrence := range occurrences {
			isCancelled, isRescheduled, overrideID = checkEventCancelledAndRescheduled(occurrence, overrides)

			if isCancelled && isRescheduled {
				continue
			}

			endTime := occurrence.Add(duration)
			facilityEvent := models.FacilityProgramClassEvent{
				ProgramClassEvent: event.ProgramClassEvent,
				InstructorName:    event.InstructorName,
				ProgramName:       event.ProgramName,
				ClassName:         event.ClassName,
				EnrolledUsers:     event.EnrolledUsers,
				StartTime:         &occurrence,
				EndTime:           &endTime,
				Frequency:         rRule.OrigOptions.Freq.String(),
				IsCancelled:       isCancelled,
				IsOverride:        isCancelled,
				OverrideID:        overrideID,
			}
			facilityEvents = append(facilityEvents, facilityEvent)
		}

		linkedOverridesMap := getLinkedOverrideEventMap(event, overrides)
		for _, override := range overrides { //adding the rescheduled ones to instances slice
			if override.IsCancelled && override.LinkedOverrideEventID == nil { //skip only cancelled ones with no links
				continue
			}
			rRule, err := rrule.StrToRRule(override.OverrideRrule)
			if err != nil {
				logrus.Warnf("unable to parse reschedule override rule: %s", override.OverrideRrule)
				continue
			}
			if len(rRule.All()) == 0 {
				logrus.Warnf("cancelled override rule does not contain a date instance, rule is: %s", override.OverrideRrule)
				continue
			}
			overrideDate := rRule.All()[0]
			duration, err := time.ParseDuration(override.Duration)
			if err != nil {
				logrus.Errorf("error parsing duration for event: %v", err)
			}
			overrideEndTime := overrideDate.Add(duration)

			var linkedOverrideEvent *models.FacilityProgramClassEvent
			if override.LinkedOverrideEventID != nil {
				linkedOverrideEvent = linkedOverridesMap[*override.LinkedOverrideEventID]
			}
			facilityEvent := models.FacilityProgramClassEvent{
				ProgramClassEvent:   event.ProgramClassEvent,
				InstructorName:      event.InstructorName,
				ProgramName:         event.ProgramName,
				ClassName:           event.ClassName,
				EnrolledUsers:       event.EnrolledUsers,
				StartTime:           &overrideDate,
				EndTime:             &overrideEndTime,
				Frequency:           rRule.OrigOptions.Freq.String(),
				IsOverride:          true,
				IsCancelled:         override.IsCancelled,
				OverrideID:          override.ID,
				LinkedOverrideEvent: linkedOverrideEvent,
			}
			facilityEvents = append(facilityEvents, facilityEvent)
		}
	}
	slices.SortFunc(facilityEvents, func(a, b models.FacilityProgramClassEvent) int {
		return b.StartTime.Compare(*a.StartTime)
	})

	return facilityEvents, nil
}

func getLinkedOverrideEventMap(event models.FacilityProgramClassEvent, overrides []models.ProgramClassEventOverride) map[uint]*models.FacilityProgramClassEvent {
	overrideEventMap := make(map[uint]*models.FacilityProgramClassEvent)
	for _, override := range overrides {
		if override.LinkedOverrideEventID != nil {
			overrideEventMap[*override.LinkedOverrideEventID] = &models.FacilityProgramClassEvent{
				ProgramClassEvent: event.ProgramClassEvent,
				InstructorName:    event.InstructorName,
				ProgramName:       event.ProgramName,
				ClassName:         event.ClassName,
				EnrolledUsers:     event.EnrolledUsers,
			}
			continue
		}

		if override.IsCancelled && override.Reason == "rescheduled" {
			programClassEvent, ok := overrideEventMap[override.ID]
			if !ok {
				continue
			}
			rRule, err := rrule.StrToRRule(override.OverrideRrule)
			if err != nil {
				logrus.Warnf("unable to parse reschedule override rule: %s", override.OverrideRrule)
				continue
			}
			if len(rRule.All()) == 0 {
				logrus.Warnf("cancelled override rule does not contain a date instance, rule is: %s", override.OverrideRrule)
				continue
			}
			overrideDate := rRule.All()[0]
			duration, err := time.ParseDuration(override.Duration)
			if err != nil {
				logrus.Errorf("error parsing duration for event: %v", err)
			}
			overrideEndTime := overrideDate.Add(duration)
			programClassEvent.StartTime = &overrideDate
			programClassEvent.EndTime = &overrideEndTime
			programClassEvent.Frequency = rRule.OrigOptions.Freq.String()
			programClassEvent.IsOverride = true
			programClassEvent.IsCancelled = true
			programClassEvent.OverrideID = override.ID
			overrideEventMap[override.ID] = programClassEvent
		}
	}
	return overrideEventMap
}

func checkEventCancelledAndRescheduled(occurrence time.Time, overrides []models.ProgramClassEventOverride) (bool, bool, uint) {
	var (
		isCancelled   = false
		isRescheduled = false
		overrideID    uint
	)

	for _, override := range overrides {
		if !override.IsCancelled { //skip
			continue
		}
		rRule, err := rrule.StrToRRule(override.OverrideRrule)
		if err != nil {
			logrus.Warnf("unable to parse cancelled override rule: %s", override.OverrideRrule)
			continue
		}
		if len(rRule.All()) == 0 {
			logrus.Warnf("cancelled override rule does not contain a date instance, rule is: %s", override.OverrideRrule)
			continue
		}
		if rRule.All()[0].Equal(occurrence) {
			isRescheduled = override.Reason == "rescheduled"
			isCancelled = true
			overrideID = override.ID
			break
		}
	}
	return isCancelled, isRescheduled, overrideID
}

func applyOverrides(event models.ProgramClassEvent, start, end time.Time) []models.EventInstance {
	var instances []models.EventInstance
	mainSet := rrule.Set{}

	duration, err := time.ParseDuration(event.Duration)
	if err != nil {
		logrus.Errorf("Error parsing duration: %s", err)
		duration = time.Hour // default duration
	}

	mainRuleOptions, err := rrule.StrToROption(event.RecurrenceRule)
	if err != nil {
		logrus.Errorf("Error parsing main event RRULE: %s", err)
		return instances
	}
	mainRuleOptions.Dtstart = mainRuleOptions.Dtstart.In(time.UTC)
	mainRule, err := rrule.NewRRule(*mainRuleOptions)
	if err != nil {
		logrus.Errorf("Error creating main RRULE: %s", err)
		return instances
	}
	mainSet.RRule(mainRule)

	var rDates []models.EventInstance

	for _, override := range event.Overrides {
		overrideOptions, err := rrule.StrToROption(override.OverrideRrule)
		if err != nil {
			logrus.Errorf("Error parsing override RRULE: %s", err)
			continue
		}
		overrideOptions.Dtstart = overrideOptions.Dtstart.In(time.UTC)
		overrideRule, err := rrule.NewRRule(*overrideOptions)
		if err != nil {
			logrus.Errorf("Error creating override RRULE: %s", err)
			continue
		}
		overrideOccurrences := overrideRule.Between(start.UTC(), end.UTC(), true)
		if override.IsCancelled {
			for _, occ := range overrideOccurrences {
				mainSet.ExDate(occ.UTC())
			}
		} else {
			for _, occ := range overrideOccurrences {
				rDateInstance := models.EventInstance{
					EventID:     event.ID,
					ClassID:     event.ClassID,
					Duration:    duration,
					StartTime:   occ.UTC(),
					IsCancelled: false,
					Room:        event.Room,
				}
				if override.Duration != "" {
					newDuration, err := time.ParseDuration(override.Duration)
					if err == nil {
						rDateInstance.Duration = newDuration
					}
				}
				if override.Room != "" {
					rDateInstance.Room = override.Room
				}
				rDates = append(rDates, rDateInstance)
				mainSet.ExDate(occ.UTC())
			}
		}
	}
	occurrences := mainSet.Between(start.UTC(), end.UTC(), true)

	for _, occ := range occurrences {
		instance := models.EventInstance{
			EventID:     event.ID,
			ClassID:     event.ClassID,
			StartTime:   occ.UTC(),
			Duration:    duration,
			IsCancelled: false,
			Room:        event.Room,
		}
		instances = append(instances, instance)
	}

	instances = append(instances, rDates...)
	sort.Slice(instances, func(i, j int) bool {
		return instances[i].StartTime.Before(instances[j].StartTime)
	})

	return instances
}

func generateEventInstances(event models.ProgramClassEvent, startDate, endDate time.Time) []models.EventInstance {
	eventInstances := applyOverrides(event, startDate, endDate)
	return eventInstances
}

// GetClassEventInstancesWithAttendanceForRecurrence returns all occurrences for events
// for a given class based on each event's recurrence rule (from DTSTART until UNTIL)
// along with their associated attendance records.
func (db *DB) GetClassEventInstancesWithAttendanceForRecurrence(classId int, qryCtx *models.QueryContext, month, year string, userId *int) ([]models.ClassEventInstance, error) {
	loc, err := time.LoadLocation(qryCtx.Timezone)
	if err != nil {
		logrus.Error("failed to load timezone")
		return nil, NewDBError(err, "failed to load timezone")
	}

	var event models.ProgramClassEvent
	if err := db.WithContext(qryCtx.Ctx).
		Model(&models.ProgramClassEvent{}).
		Preload("Overrides").
		Where("class_id = ?", classId).
		Order("created_at DESC").
		First(&event).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_events")
	}

	rRule, err := event.GetRRule()
	if err != nil {
		logrus.Errorf("event has invalid rule, event: %v", event)
	}

	var startTime, untilTime time.Time

	if month == "" || year == "" {
		if userId != nil {
			var enrollment models.ProgramClassEnrollment
			err := db.WithContext(qryCtx.Ctx).
				Model(&models.ProgramClassEnrollment{}).
				Where("class_id = ? AND user_id = ?", classId, *userId).
				First(&enrollment).Error
			if err != nil {
				return nil, newGetRecordsDBError(err, "program_class_enrollments")
			}
			startTime = rRule.GetDTStart()
			if enrollment.CreatedAt.After(startTime) {
				startTime = enrollment.CreatedAt.Truncate(24 * time.Hour)
			}
			untilTime = time.Now().AddDate(0, 0, 1).Truncate(24 * time.Hour)
			if enrollment.EnrollmentStatus != "Enrolled" {
				untilTime = enrollment.UpdatedAt.AddDate(0, 0, 1).Truncate(24 * time.Hour)
			}
		} else {
			startTime = time.Now().Add(time.Hour * 24 * -14)
			untilTime = startTime.AddDate(0, 1, 0)
		}
	} else {
		yearInt, err := strconv.Atoi(year)
		if err != nil {
			return nil, NewDBError(err, "invalid year query parameter")
		}
		monthInt, err := strconv.Atoi(month)
		if err != nil {
			return nil, NewDBError(err, "invalid month query parameter")
		}
		startTime = time.Date(yearInt, time.Month(monthInt), 1, 0, 0, 0, 0, loc)
		untilTime = startTime.AddDate(0, 1, 0)
	}

	occurrences := rRule.Between(startTime, untilTime, true)
	if len(occurrences) == 0 {
		qryCtx.Total = 0
		return []models.ClassEventInstance{}, nil
	}

	duration, err := time.ParseDuration(event.Duration)
	if err != nil {
		logrus.Errorf("error parsing duration for event: %v", err)
	}
	firstOcc := occurrences[0]
	lastOcc := occurrences[len(occurrences)-1]
	occInLoc := firstOcc.In(loc)
	occDateStr := occInLoc.Format("2006-01-02")
	lastOccInLoc := lastOcc.In(loc)
	lastOccDateStr := lastOccInLoc.Format("2006-01-02")
	startTimeStr := occInLoc.Format("15:04")
	endTimeStr := occInLoc.Add(duration).Format("15:04")
	//FIXME: when overrides are applied, this will likely have to be in the loop
	classTime := startTimeStr + "-" + endTimeStr
	var attendances []models.ProgramClassEventAttendance

	tx := db.WithContext(qryCtx.Ctx).
		Model(&models.ProgramClassEventAttendance{}).
		Where("event_id = ? AND date BETWEEN SYMMETRIC ? AND ?", event.ID, occDateStr, lastOccDateStr)
	if userId != nil {
		tx = tx.Where("user_id = ?", *userId)
	}
	if err := tx.
		Order("date DESC").
		Find(&attendances).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_event_attendances")
	}

	eventInstances := createEventInstances(event, occurrences, loc, classTime, attendances)

	qryCtx.Total = int64(len(eventInstances))
	offset := qryCtx.CalcOffset()
	end := offset + qryCtx.PerPage
	if offset >= len(eventInstances) {
		eventInstances = []models.ClassEventInstance{}
	} else if end > len(eventInstances) {
		eventInstances = eventInstances[offset:]
	} else {
		eventInstances = eventInstances[offset:end]
	}

	return eventInstances, nil
}

func createEventInstances(event models.ProgramClassEvent, occurrences []time.Time, loc *time.Location, classTime string, attendances []models.ProgramClassEventAttendance) []models.ClassEventInstance {
	var eventInstances []models.ClassEventInstance
	for _, occ := range occurrences {
		occInLoc := occ.In(loc)
		occDateStr := occInLoc.Format("2006-01-02")

		isCancelled, isRescheduled, _ := checkEventCancelledAndRescheduled(occ, event.Overrides)

		if isCancelled && isRescheduled { //skip occurrence
			continue
		}

		relevantAttendance := src.FilterMap(attendances, func(att models.ProgramClassEventAttendance) bool {
			return att.Date == occDateStr
		})

		eventInstance := models.ClassEventInstance{
			EventID:           event.ID,
			ClassTime:         classTime,
			Date:              occDateStr,
			AttendanceRecords: relevantAttendance,
			IsCancelled:       isCancelled,
		}
		eventInstances = append(eventInstances, eventInstance)
	}
	for _, override := range event.Overrides { //adding the rescheduled ones to instances slice
		if override.IsCancelled { //skip cancelled ones
			continue
		}
		rRule, err := rrule.StrToRRule(override.OverrideRrule)
		if err != nil {
			logrus.Warnf("unable to parse reschedule override rule: %s", override.OverrideRrule)
			continue
		}
		if len(rRule.All()) == 0 {
			logrus.Warnf("cancelled override rule does not contain a date instance, rule is: %s", override.OverrideRrule)
			continue
		}
		overrideDate := rRule.All()[0]
		overrideDateStr := overrideDate.In(loc).Format("2006-01-02")

		duration, err := time.ParseDuration(override.Duration)
		if err != nil {
			logrus.Errorf("error parsing duration for event: %v", err)
		}
		overrideEnd := overrideDate.Add(duration)
		overrideClassTime := overrideDate.In(loc).Format("15:04") + "-" + overrideEnd.In(loc).Format("15:04")

		relevantAttendance := src.FilterMap(attendances, func(att models.ProgramClassEventAttendance) bool {
			return att.Date == overrideDateStr
		})
		rescheduledInstance := models.ClassEventInstance{
			EventID:           event.ID,
			ClassTime:         overrideClassTime,
			Date:              overrideDateStr,
			AttendanceRecords: relevantAttendance,
			IsCancelled:       false,
		}
		eventInstances = append(eventInstances, rescheduledInstance)
	}
	slices.SortFunc(eventInstances, func(a, b models.ClassEventInstance) int {
		return cmp.Compare(b.Date, a.Date)
	})
	return eventInstances
}

func (db *DB) GetCancelledOverrideEvents(qryCtx *models.QueryContext, eventId int) ([]models.ProgramClassEventOverride, error) {
	overrides := make([]models.ProgramClassEventOverride, 0)
	if err := db.WithContext(qryCtx.Ctx).Model(&models.ProgramClassEventOverride{}).Where("event_id = ? and is_cancelled = true", eventId).Find(&overrides).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_event_overrides")
	}
	return overrides, nil
}

func (db *DB) GetClassEventDatesForRecurrence(classID int, timezone string, month, year string, eventId *int) ([]models.EventDates, error) {
	var event models.ProgramClassEvent
	query := db.Preload("Overrides").Where("class_id = ?", classID)

	// if specific event_id is provided, use it, otherwise get the latest event
	if eventId != nil {
		query = query.Where("id = ?", *eventId)
	} else {
		query = query.Order("created_at DESC")
	}

	if err := query.First(&event).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_events")
	}

	loc, _ := time.LoadLocation(timezone)
	rule, err := event.GetRRule()
	if err != nil {
		return nil, err
	}

	y, _ := strconv.Atoi(year)
	m, _ := strconv.Atoi(month)
	start := time.Date(y, time.Month(m), 1, 0, 0, 0, 0, loc)
	until := start.AddDate(0, 1, 0)

	occs := rule.Between(start, until, true)

	out := make([]models.EventDates, len(occs))
	for i, occ := range occs {
		d := occ.In(loc).Format("2006-01-02")
		out[i] = models.EventDates{
			EventID: event.ID,
			Date:    d,
		}
	}
	return out, nil
}

func (db *DB) GetProgramClassEventOverrides(qryCtx *models.QueryContext, eventIDs ...uint) ([]models.ProgramClassEventOverride, error) {
	overrides := make([]models.ProgramClassEventOverride, 0)
	if err := db.WithContext(qryCtx.Ctx).Model(&models.ProgramClassEventOverride{}).Where("event_id IN (?)", eventIDs).Order("id desc").Find(&overrides).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_event_overrides")
	}
	return overrides, nil
}
