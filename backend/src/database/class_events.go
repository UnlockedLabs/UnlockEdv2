package database

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/models"
	"cmp"
	"errors"
	"slices"
	"sort"
	"strconv"
	"strings"
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

	if err := db.syncClassDateBoundaries(trans, uint(classID)); err != nil {
		trans.Rollback()
		return err
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
			DoUpdates: clause.AssignmentColumns([]string{"duration", "override_rrule", "is_cancelled", "room_id", "reason", "linked_override_event_id"}),
		}).Create(&overrideEvent).Error; err != nil {
			trans.Rollback()
			return newCreateDBError(err, "program_class_event_overrides")
		}
		if overrideEvent.IsCancelled && len(overrideEvents) < 2 { //only add log for cancelled event
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
			changeLogEntry.OldValue = &overrideEvent.OverrideRrule
		}
		if overrideEvent.IsCancelled || isOverrideUpdate { //delete attendance
			eventDate, err = overrideEvent.GetFormattedOverrideDate("2006-01-02")
			if err != nil {
				trans.Rollback()
				return NewDBError(err, "unable to parse override date")
			}
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

	if len(overrideEvents) > 0 {
		if err := db.syncClassDateBoundaries(trans, overrideEvents[0].ClassID); err != nil {
			trans.Rollback()
			return err
		}
	}

	//end transaction
	if err := trans.Commit().Error; err != nil {
		return NewDBError(err, "unable to commit the database transaction")
	}
	return nil
}

func (db *DB) syncClassDateBoundaries(trans *gorm.DB, classID uint) error {
	var event models.ProgramClassEvent
	if err := trans.Preload("Overrides").Where("class_id = ?", classID).First(&event).Error; err != nil {
		return newGetRecordsDBError(err, "program_class_events")
	}

	var class models.ProgramClass
	if err := trans.First(&class, "id = ?", classID).Error; err != nil {
		return newGetRecordsDBError(err, "program_classes")
	}

	rRule, err := event.GetRRule()
	if err != nil {
		return err
	}

	originalBaseStart := rRule.OrigOptions.Dtstart.In(time.UTC)
	ruleUntil := rRule.GetUntil()

	startBoundary := class.StartDt
	endBoundary := startBoundary.AddDate(5, 0, 0)
	if class.EndDt != nil {
		endBoundary = class.EndDt.AddDate(0, 3, 0)
	}

	baseOccurrences := rRule.Between(startBoundary, endBoundary, true)
	if len(baseOccurrences) == 0 {
		return nil
	}

	cancelledDates := make(map[string]bool)
	rescheduledDates := make([]time.Time, 0)
	var earliestReschedule time.Time

	for _, override := range event.Overrides {
		overrideRule, err := rrule.StrToRRule(override.OverrideRrule)
		if err != nil {
			logrus.Warnf("unable to parse override rule: %s", override.OverrideRrule)
			continue
		}
		occurrences := overrideRule.All()
		if len(occurrences) == 0 {
			continue
		}

		overrideDate := occurrences[0].In(time.UTC)
		if override.IsCancelled {
			cancelledDates[overrideDate.Format("2006-01-02")] = true
			continue
		}

		rescheduledDates = append(rescheduledDates, overrideDate)
		if earliestReschedule.IsZero() || overrideDate.Before(earliestReschedule) {
			earliestReschedule = overrideDate
		}
	}

	allDates := make([]time.Time, 0, len(baseOccurrences)+len(rescheduledDates))
	for _, occurrence := range baseOccurrences {
		if !cancelledDates[occurrence.Format("2006-01-02")] {
			allDates = append(allDates, occurrence)
		}
	}
	allDates = append(allDates, rescheduledDates...)

	if len(allDates) == 0 {
		return nil
	}

	sort.Slice(allDates, func(i, j int) bool {
		return allDates[i].Before(allDates[j])
	})

	computedEnd := allDates[len(allDates)-1]

	updates := make(map[string]any)

	targetStart := originalBaseStart
	if !earliestReschedule.IsZero() && earliestReschedule.Before(originalBaseStart) {
		targetStart = earliestReschedule
	}
	if !targetStart.Equal(class.StartDt) {
		updates["start_dt"] = targetStart
	}

	hasOverrides := len(event.Overrides) > 0

	if class.EndDt == nil || !computedEnd.Equal(*class.EndDt) {
		if (!hasOverrides && !ruleUntil.IsZero()) || (!ruleUntil.IsZero() && ruleUntil.After(computedEnd)) {
			updates["end_dt"] = ruleUntil
		} else {
			updates["end_dt"] = computedEnd
		}
	} else if (!hasOverrides && !ruleUntil.IsZero() && !ruleUntil.Equal(*class.EndDt)) || (!ruleUntil.IsZero() && ruleUntil.After(*class.EndDt)) {
		updates["end_dt"] = ruleUntil
	}

	if len(updates) == 0 {
		return nil
	}

	if err := trans.Model(&models.ProgramClass{}).Where("id = ?", classID).Updates(updates).Error; err != nil {
		return newUpdateDBError(err, "program_classes")
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
	if form.RoomID != nil {
		override.RoomID = form.RoomID
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
		Select(`pcev.id, pcev.created_at, pcev.updated_at, pcev.deleted_at, pcev.class_id, pcev.duration, pcev.recurrence_rule, pcev.room_id,
		r.name as room,
		p.name as program_name,
		c.instructor_name,
		c.name as class_name,
		c.status as class_status,
        STRING_AGG(CONCAT(u.id, ':', u.name_last, ', ', u.name_first), '|' ORDER BY u.name_last) FILTER (WHERE e.enrollment_status = 'Enrolled') AS enrolled_users`).
		Joins("JOIN program_classes c ON c.id = pcev.class_id and c.archived_at IS NULL").
		Joins("JOIN programs p ON p.id = c.program_id").
		Joins("LEFT JOIN rooms r ON r.id = pcev.room_id").
		Joins("LEFT JOIN program_class_enrollments e ON e.class_id = c.id").
		Joins("LEFT JOIN users u ON e.user_id = u.id").
		Where("c.facility_id = ?", args.FacilityID)

	if classID > 0 {
		tx = tx.Where("c.id = ?", classID)
	}
	if !args.IsAdmin {
		tx = tx.Where("u.id = ? AND e.enrollment_status = 'Enrolled'", args.UserID)
	}
	tx = tx.Group("pcev.id, c.instructor_name, c.name, c.status, p.name, r.name")
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
		rRule, err := event.GetRRuleWithTimezone(args.Timezone)
		if err != nil {
			return nil, err
		}
		occurrences := rRule.Between(dtRng.Start, dtRng.End, true)
		duration, err := time.ParseDuration(event.Duration)
		if err != nil {
			return nil, err
		}

		//daylight saving time fix (VIP) prevents the time shift
		canonicalHour, canonicalMinute := getCanonicalHourAndMinute(occurrences, args.Timezone)
		overrides := overrideEventMap[event.ID]
		var (
			isCancelled, isRescheduled bool
			overrideID                 uint
		)
		userLocation, _ := time.LoadLocation(args.Timezone)
		for _, occurrence := range occurrences {
			localOccurrence := occurrence.In(userLocation)
			consistentOccurrence := time.Date(
				localOccurrence.Year(),
				localOccurrence.Month(),
				localOccurrence.Day(),
				canonicalHour,
				canonicalMinute,
				0,
				0,
				userLocation,
			)
			isCancelled, isRescheduled, overrideID = checkEventCancelledAndRescheduled(consistentOccurrence, overrides, args.Timezone)

			if isCancelled && isRescheduled {
				continue
			}

			endTime := consistentOccurrence.Add(duration)
			facilityEvent := models.FacilityProgramClassEvent{
				ProgramClassEvent: event.ProgramClassEvent,
				Room:              event.Room,
				InstructorName:    event.InstructorName,
				ProgramName:       event.ProgramName,
				ClassName:         event.ClassName,
				EnrolledUsers:     event.EnrolledUsers,
				ClassStatus:       event.ClassStatus,
				StartTime:         &consistentOccurrence,
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

			userLocation, _ := time.LoadLocation(args.Timezone)
			localOverrideTime := overrideDate.In(userLocation)
			consistentOverrideDate := time.Date(
				localOverrideTime.Year(),
				localOverrideTime.Month(),
				localOverrideTime.Day(),
				localOverrideTime.Hour(),
				localOverrideTime.Minute(),
				0,
				0,
				userLocation,
			)
			overrideEndTime := consistentOverrideDate.Add(duration)
			var linkedOverrideEvent *models.FacilityProgramClassEvent
			if override.LinkedOverrideEventID != nil {
				linkedOverrideEvent = linkedOverridesMap[*override.LinkedOverrideEventID]
			}
			pce := event.ProgramClassEvent
			roomName := event.Room
			if override.RoomRef != nil {
				roomName = override.RoomRef.Name
				pce.RoomID = override.RoomID
			}
			facilityEvent := models.FacilityProgramClassEvent{
				ProgramClassEvent:   pce,
				Room:                roomName,
				InstructorName:      event.InstructorName,
				ProgramName:         event.ProgramName,
				ClassName:           event.ClassName,
				EnrolledUsers:       event.EnrolledUsers,
				ClassStatus:         event.ClassStatus,
				StartTime:           &consistentOverrideDate,
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

// returns the hour and minute from the first occurrence within the slice of time.Time instances
func getCanonicalHourAndMinute(occurrences []time.Time, timezone string) (int, int) {
	var canonicalHour, canonicalMinute int
	if len(occurrences) > 0 {
		firstOccurrence := occurrences[0]
		userLocation, err := time.LoadLocation(timezone)
		if err == nil {
			localTime := firstOccurrence.In(userLocation)
			canonicalHour = localTime.Hour()
			canonicalMinute = localTime.Minute()
		} else {
			logrus.Warnf("unable to load the user's timezone while trying to get the canonical hour and minute. Error is: %v", err)
			canonicalHour = firstOccurrence.Hour()
			canonicalMinute = firstOccurrence.Minute()
		}
	}
	return canonicalHour, canonicalMinute
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

func checkEventCancelledAndRescheduled(occurrence time.Time, overrides []models.ProgramClassEventOverride, timezone string) (bool, bool, uint) {
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
		overrideDate := rRule.All()[0]

		//START day light savings time fix here
		userLocation, _ := time.LoadLocation(timezone)
		localOverrideTime := overrideDate.In(userLocation)
		canonicalOverrideHour := localOverrideTime.Hour()
		canonicalOverrideMinute := localOverrideTime.Minute()
		consistentOverrideDate := time.Date(
			localOverrideTime.Year(),
			localOverrideTime.Month(),
			localOverrideTime.Day(),
			canonicalOverrideHour,
			canonicalOverrideMinute,
			0, 0,
			userLocation,
		)
		//END day light savings time fix here
		if consistentOverrideDate.Equal(occurrence) {
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
				roomName := getRoomName(event.RoomRef)
				rDateInstance := models.EventInstance{
					EventID:     event.ID,
					ClassID:     event.ClassID,
					Duration:    duration,
					StartTime:   occ.UTC(),
					IsCancelled: false,
					Room:        roomName,
				}
				if override.Duration != "" {
					newDuration, err := time.ParseDuration(override.Duration)
					if err == nil {
						rDateInstance.Duration = newDuration
					}
				}
				if override.RoomRef != nil {
					rDateInstance.Room = override.RoomRef.Name
				}
				rDates = append(rDates, rDateInstance)
				mainSet.ExDate(occ.UTC())
			}
		}
	}
	occurrences := mainSet.Between(start.UTC(), end.UTC(), true)

	roomName := getRoomName(event.RoomRef)
	for _, occ := range occurrences {
		instance := models.EventInstance{
			EventID:     event.ID,
			ClassID:     event.ClassID,
			StartTime:   occ.UTC(),
			Duration:    duration,
			IsCancelled: false,
			Room:        roomName,
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

	rRule, err := event.GetRRuleWithTimezone(qryCtx.Timezone)
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

	// occurrences can be empty if there are no base rule occurrences in the window
	// but we still need to check for overrides and fetch attendance
	var classTime string
	var canonicalHour, canonicalMinute int
	if len(occurrences) > 0 {
		duration, err := time.ParseDuration(event.Duration)
		if err != nil {
			logrus.Errorf("error parsing duration for event: %v", err)
		}

		startTime = rRule.GetDTStart()
		userLocation, _ := time.LoadLocation(loc.String())
		localStartTime := startTime.In(userLocation)
		canonicalHour = localStartTime.Hour()
		canonicalMinute = localStartTime.Minute()

		firstOcc := occurrences[0]
		//day light savings time issue
		consistentOccurrence := time.Date(
			firstOcc.Year(),
			firstOcc.Month(),
			firstOcc.Day(),
			canonicalHour,
			canonicalMinute,
			0,
			0,
			loc,
		)

		startTimeStr := consistentOccurrence.Format("15:04")
		endTimeStr := consistentOccurrence.Add(duration).Format("15:04")
		classTime = startTimeStr + "-" + endTimeStr
	}
	var attendances []models.ProgramClassEventAttendance

	startDateStr := startTime.Format("2006-01-02")
	endDateStr := untilTime.Format("2006-01-02")

	// Fetch all event IDs for this class to ensure we get attendance even if it's linked to an older event rule
	var classEventIDs []uint
	if err := db.WithContext(qryCtx.Ctx).Model(&models.ProgramClassEvent{}).Where("class_id = ?", classId).Pluck("id", &classEventIDs).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_events")
	}

	tx := db.WithContext(qryCtx.Ctx).
		Model(&models.ProgramClassEventAttendance{}).
		Where("event_id IN (?) AND date >= ? AND date < ?", classEventIDs, startDateStr, endDateStr)
	if userId != nil {
		tx = tx.Where("user_id = ?", *userId)
	}
	if err := tx.
		Order("date DESC").
		Find(&attendances).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_event_attendances")
	}

	eventInstances := createEventInstances(event, occurrences, loc, classTime, attendances, canonicalHour, canonicalMinute)

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

func createEventInstances(event models.ProgramClassEvent, occurrences []time.Time, loc *time.Location, classTime string, attendances []models.ProgramClassEventAttendance, canonicalHour, canonicalMinute int) []models.ClassEventInstance {
	var eventInstances []models.ClassEventInstance
	//daylight saving time fix (VIP) prevents the time shift
	for _, occ := range occurrences {
		occInLoc := occ.In(loc)
		occDateStr := occInLoc.Format("2006-01-02")
		consistentOccurrence := time.Date(
			occ.Year(),
			occ.Month(),
			occ.Day(),
			canonicalHour,
			canonicalMinute,
			0,
			0,
			loc,
		)
		isCancelled, isRescheduled, _ := checkEventCancelledAndRescheduled(consistentOccurrence, event.Overrides, loc.String())

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
	rule, err := event.GetRRuleWithTimezone(timezone)
	if err != nil {
		return nil, err
	}

	y, _ := strconv.Atoi(year)
	m, _ := strconv.Atoi(month)
	start := time.Date(y, time.Month(m), 1, 0, 0, 0, 0, loc)
	until := start.AddDate(0, 1, 0)

	occs := rule.Between(start, until, true)

	duration, err := time.ParseDuration(event.Duration)
	if err != nil {
		logrus.Errorf("error parsing duration for event: %v", err)
		duration = time.Hour
	}

	var canonicalHour, canonicalMinute int
	if len(occs) > 0 {
		localStart := rule.GetDTStart().In(loc)
		canonicalHour = localStart.Hour()
		canonicalMinute = localStart.Minute()
	}

	out := make([]models.EventDates, 0, len(occs))
	for _, occ := range occs {
		isCancelled, _, _ := checkEventCancelledAndRescheduled(occ, event.Overrides, timezone)
		if isCancelled {
			continue
		}
		occInLoc := occ.In(loc)
		// lock the hour/minute to the canonical values to avoid DST shift :(
		consistentStart := time.Date(
			occInLoc.Year(),
			occInLoc.Month(),
			occInLoc.Day(),
			canonicalHour,
			canonicalMinute,
			0,
			0,
			loc,
		)
		startStr := consistentStart.Format("15:04")
		endStr := consistentStart.Add(duration).Format("15:04")
		out = append(out, models.EventDates{
			EventID:   event.ID,
			Date:      consistentStart.Format("2006-01-02"),
			ClassTime: startStr + "-" + endStr,
		})
	}

	//checking the overrides for rescheduled dates (non-cancelled overrides are reschedule targets)
	for _, override := range event.Overrides {
		if override.IsCancelled {
			continue
		}
		rRule, err := rrule.StrToRRule(override.OverrideRrule)
		if err != nil || len(rRule.All()) == 0 {
			continue
		}
		overrideDate := rRule.All()[0].In(loc)
		if overrideDate.Before(start) || !overrideDate.Before(until) {
			continue
		}
		dur, err := time.ParseDuration(override.Duration)
		if err != nil {
			logrus.Errorf("error parsing override duration for event: %v", err)
			dur = duration
		}
		classTime := overrideDate.Format("15:04") + "-" + overrideDate.Add(dur).Format("15:04")
		out = append(out, models.EventDates{
			EventID:   event.ID,
			Date:      overrideDate.Format("2006-01-02"),
			ClassTime: classTime,
		})
	}

	return out, nil
}

func (db *DB) GetProgramClassEventOverrides(qryCtx *models.QueryContext, eventIDs ...uint) ([]models.ProgramClassEventOverride, error) {
	overrides := make([]models.ProgramClassEventOverride, 0)
	if err := db.WithContext(qryCtx.Ctx).Model(&models.ProgramClassEventOverride{}).Preload("RoomRef").Where("event_id IN (?)", eventIDs).Order("id desc").Find(&overrides).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_event_overrides")
	}
	return overrides, nil
}

func (db *DB) UpdateClassEventRRuleUntilDate(tx *gorm.DB, classIDs []int, completionTime time.Time) error {
	if len(classIDs) == 0 {
		return NewDBError(errors.New("no class IDs provided"), "no class IDs provided")
	}

	var events []struct {
		ID             uint   `json:"id"`
		RecurrenceRule string `json:"recurrence_rule"`
	}

	if err := tx.Model(&models.ProgramClassEvent{}).Select("id, recurrence_rule").Where("class_id IN (?)", classIDs).Find(&events).Error; err != nil {
		return newGetRecordsDBError(err, "program_class_events")
	}

	if len(events) == 0 {
		return NewDBError(errors.New("no events found for the provided class IDs"), "no events found for the provided class IDs")
	}

	untilDateStr := src.FormatDateForUntil(completionTime)
	updates := make(map[uint]string, len(events))
	eventIDs := make([]uint, len(events))
	for i, event := range events {
		eventIDs[i] = event.ID
		updates[event.ID] = src.ReplaceOrAddUntilDate(event.RecurrenceRule, untilDateStr)
	}

	caseParts := make([]string, 0, len(updates))
	args := make([]any, 0, len(updates)*2)

	for eventID, newRRule := range updates {
		caseParts = append(caseParts, "WHEN id = ? THEN ?")
		args = append(args, eventID, newRRule)
	}

	caseSQL := "CASE " + strings.Join(caseParts, " ") + " END"
	if err := tx.Model(&models.ProgramClassEvent{}).Where("id IN (?)", eventIDs).Update("recurrence_rule", gorm.Expr(caseSQL, args...)).Error; err != nil {
		return newUpdateDBError(err, "program_class_events")
	}
	return nil
}

func getRoomName(roomRef *models.Room) string {
	if roomRef != nil {
		return roomRef.Name
	}
	return "TBD"
}
