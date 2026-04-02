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

// UncancelOverride flips an override from cancelled back to non-cancelled via a direct
// UPDATE. Used when undoing only the cancellation of a rescheduled class — the override
// stays in place (preserving the reschedule link) but is no longer cancelled.
func (db *DB) UncancelOverride(ctx *models.QueryContext, overrideID uint) error {
	return db.WithContext(ctx.Ctx).
		Model(&models.ProgramClassEventOverride{}).
		Where("id = ?", overrideID).
		Updates(map[string]interface{}{
			"is_cancelled": false,
			"reason":       "",
		}).Error
}

// Soft deletes ProgramClassEventOverride by its ID, removes any associated attendance records, and logs the change.
// If the ProgramClassEventOverride to be deleted has an exiting LinkedOverrideEventID (rescheduled event) that ProgramClassEventOverride is deleted
func (db *DB) DeleteOverrideEvent(args *models.QueryContext, eventID int, classID int, undoAppliedFuture bool) error {
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

	// Collect all overrides in the chain for deletion.
	// Follows both directions: forward links (LinkedOverrideEventID) and reverse
	// links (overrides linking TO this one). BFS traverses the full chain so
	// undoing A in A→B→C deletes all three overrides.
	eventIDs = append(eventIDs, override.ID)
	visited := map[uint]bool{override.ID: true}
	queue := []uint{override.ID}
	// Seed the queue with the forward link if it exists
	if override.LinkedOverrideEventID != nil {
		fwd := *override.LinkedOverrideEventID
		if !visited[fwd] {
			visited[fwd] = true
			eventIDs = append(eventIDs, fwd)
			queue = append(queue, fwd)
		}
	}
	for len(queue) > 0 {
		currentID := queue[0]
		queue = queue[1:]
		// Reverse links: overrides that point TO currentID
		var reverseLinked []models.ProgramClassEventOverride
		if err := trans.Where("linked_override_event_id = ?", currentID).Find(&reverseLinked).Error; err == nil {
			for _, rl := range reverseLinked {
				if !visited[rl.ID] {
					visited[rl.ID] = true
					eventIDs = append(eventIDs, rl.ID)
					queue = append(queue, rl.ID)
				}
			}
		}
		// Forward link: the override that currentID points to
		var current models.ProgramClassEventOverride
		if err := trans.Where("id = ?", currentID).First(&current).Error; err == nil {
			if current.LinkedOverrideEventID != nil {
				fwd := *current.LinkedOverrideEventID
				if !visited[fwd] {
					visited[fwd] = true
					eventIDs = append(eventIDs, fwd)
					queue = append(queue, fwd)
				}
			}
		}
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
	var parentCancelIDs []uint
	for _, overrideEvent := range overrideEvents {
		if !overrideEvent.IsCancelled && linkedOverrideID != nil {
			overrideEvent.LinkedOverrideEventID = linkedOverrideID
			// Clean up old reschedule targets: when re-rescheduling (A→B then B→C),
			// the old target (B's non-cancelled override) must be removed so only
			// the new target (C) remains linked to A's cancel override.
			if err := trans.Where("linked_override_event_id = ? AND is_cancelled = false AND id != ? AND deleted_at IS NULL",
				*linkedOverrideID, overrideEvent.ID).
				Delete(&models.ProgramClassEventOverride{}).Error; err != nil {
				trans.Rollback()
				return NewDBError(err, "unable to clean up old reschedule targets")
			}
		}
		if overrideEvent.ID == 0 {
			var existing models.ProgramClassEventOverride
			if err := trans.Unscoped().
				Where("event_id = ? AND override_rrule = ? AND deleted_at IS NULL",
					overrideEvent.EventID, overrideEvent.OverrideRrule).
				First(&existing).Error; err == nil {
				// If the existing override is a reschedule target linked from a cancel,
				// remember the parent cancel so we can preserve it after the upsert
				if existing.LinkedOverrideEventID != nil && *existing.LinkedOverrideEventID != existing.ID {
					parentCancelIDs = append(parentCancelIDs, *existing.LinkedOverrideEventID)
				}
				overrideEvent.ID = existing.ID
				// Preserve the chain link when overwriting a reschedule target with a cancel.
				// Example: After A→B, B's override has linked=A_cancel. When B is cancelled,
				// the incoming cancel has linked=nil. Carry forward so the A←B chain survives.
				if overrideEvent.LinkedOverrideEventID == nil && existing.LinkedOverrideEventID != nil {
					overrideEvent.LinkedOverrideEventID = existing.LinkedOverrideEventID
				}
			}
		}
		isOverrideUpdate = overrideEvent.ID > 0
		if isOverrideUpdate {
			// Existing override found — do a direct UPDATE to avoid GORM's
			// soft-delete behavior with Create+OnConflict which deletes the
			// existing record and creates a new one (breaking chain links).
			if err := trans.Model(&models.ProgramClassEventOverride{}).
				Where("id = ?", overrideEvent.ID).
				Updates(map[string]interface{}{
					"duration":                 overrideEvent.Duration,
					"override_rrule":           overrideEvent.OverrideRrule,
					"is_cancelled":             overrideEvent.IsCancelled,
					"room_id":                  overrideEvent.RoomID,
					"reason":                   overrideEvent.Reason,
					"linked_override_event_id": overrideEvent.LinkedOverrideEventID,
					"instructor_id":            overrideEvent.InstructorID,
				}).Error; err != nil {
				trans.Rollback()
				return newCreateDBError(err, "program_class_event_overrides")
			}
		} else {
			if err := trans.Create(&overrideEvent).Error; err != nil {
				trans.Rollback()
				return newCreateDBError(err, "program_class_event_overrides")
			}
		}
		if overrideEvent.IsCancelled && len(overrideEvents) < 2 {
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
		} else if overrideEvent.IsCancelled {
			linkedOverrideID = &overrideEvent.ID
			changeLogEntry.OldValue = &overrideEvent.OverrideRrule
		}
		if !overrideEvent.IsCancelled && overrideEvent.InstructorID != nil {
			var instructor models.User
			if err := trans.Select("name_first", "name_last").First(&instructor, *overrideEvent.InstructorID).Error; err == nil {
				eventDate, _ := overrideEvent.GetFormattedOverrideDate("1/02/2006")
				summary := instructor.NameFirst + " " + instructor.NameLast + " on " + *eventDate
				changeLogEntry.FieldName = "event_substitute_instructor"
				changeLogEntry.ParentRefID = overrideEvent.ClassID
				changeLogEntry.NewValue = &summary
			}
		}
		if !overrideEvent.IsCancelled && overrideEvent.RoomID != nil && len(overrideEvents) == 1 {
			var room models.Room
			if err := trans.Select("name").First(&room, *overrideEvent.RoomID).Error; err == nil {
				eventDate, _ := overrideEvent.GetFormattedOverrideDate("1/02/2006")
				summary := room.Name + " on " + *eventDate
				changeLogEntry.FieldName = "event_room_changed"
				changeLogEntry.ParentRefID = overrideEvent.ClassID
				changeLogEntry.NewValue = &summary
			}
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

	// Restore parent cancel overrides that may have been soft-deleted by the upsert.
	// This preserves the A→B→C chain: when rescheduling B→C, A's cancel must survive.
	if len(parentCancelIDs) > 0 {
		if err := trans.Unscoped().Model(&models.ProgramClassEventOverride{}).
			Where("id IN ?", parentCancelIDs).
			Update("deleted_at", nil).Error; err != nil {
			trans.Rollback()
			return NewDBError(err, "unable to restore parent cancel overrides")
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
	// rrule-go's GetUntil() returns a far-future date (~year 2318) instead of zero
	// when no UNTIL is present, so check the raw string for an explicit UNTIL clause
	hasExplicitUntil := strings.Contains(event.RecurrenceRule, "UNTIL=")
	var ruleUntil time.Time
	if hasExplicitUntil {
		ruleUntil = rRule.GetUntil()
	}

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
		c.program_id as program_id,
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
	tx = tx.Group("pcev.id, c.instructor_name, c.name, c.status, c.program_id, p.name, r.name")
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
				ProgramID:         event.ProgramID,
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
				ProgramID:           event.ProgramID,
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

func GenerateEventInstances(event models.ProgramClassEvent, startDate, endDate time.Time) []models.EventInstance {
	return generateEventInstances(event, startDate, endDate)
}

// GetClassEventInstancesWithAttendanceForRecurrence returns all occurrences for events
// for a given class based on each event's recurrence rule (from DTSTART until UNTIL)
// along with their associated attendance records.
func (db *DB) GetClassEventInstancesWithAttendanceForRecurrence(classId int, qryCtx *models.QueryContext, month, year string, userId *int, allInstances bool) ([]models.ClassEventInstance, error) {
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
			startTime = rRule.GetDTStart()
			if allInstances {
				// rrule-go's GetUntil() returns a far-future date (~year 2318) instead of zero
				// when no UNTIL is present, so check the raw string for an explicit UNTIL clause
				hasExplicitUntil := strings.Contains(event.RecurrenceRule, "UNTIL=")
				if hasExplicitUntil {
					untilTime = rRule.GetUntil().AddDate(0, 0, 1)
				} else {
					untilTime = time.Now().AddDate(1, 0, 0).Truncate(24 * time.Hour)
				}
				maxFuture := time.Now().AddDate(0, 6, 0).Truncate(24 * time.Hour)
				if untilTime.After(maxFuture) {
					untilTime = maxFuture
				}
			} else {
				untilTime = time.Now().AddDate(0, 1, 0).Truncate(24 * time.Hour)
			}
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
		// Use the DTSTART's own timezone to extract the canonical wall-clock time,
		// not the user's timezone. The DTSTART time represents the class's local
		// wall-clock time at the facility, so converting to a different timezone
		// would shift the displayed time incorrectly.
		canonicalHour = startTime.Hour()
		canonicalMinute = startTime.Minute()

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
	if !qryCtx.All {
		offset := qryCtx.CalcOffset()
		end := offset + qryCtx.PerPage
		if offset >= len(eventInstances) {
			eventInstances = []models.ClassEventInstance{}
		} else if end > len(eventInstances) {
			eventInstances = eventInstances[offset:]
		} else {
			eventInstances = eventInstances[offset:end]
		}
	}

	return eventInstances, nil
}

func createEventInstances(event models.ProgramClassEvent, occurrences []time.Time, loc *time.Location, classTime string, attendances []models.ProgramClassEventAttendance, canonicalHour, canonicalMinute int) []models.ClassEventInstance {
	// Pre-index attendance by date for O(1) lookup instead of scanning all records per occurrence
	attendanceByDate := make(map[string][]models.ProgramClassEventAttendance, len(attendances))
	for i := range attendances {
		attendanceByDate[attendances[i].Date] = append(attendanceByDate[attendances[i].Date], attendances[i])
	}

	eventInstances := make([]models.ClassEventInstance, 0, len(occurrences))
	//daylight saving time fix (VIP) prevents the time shift
	for _, occ := range occurrences {
		occDateStr := occ.In(loc).Format("2006-01-02")
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
		isCancelled, isRescheduled, overrideID := checkEventCancelledAndRescheduled(consistentOccurrence, event.Overrides, loc.String())

		eventInstance := models.ClassEventInstance{
			EventID:           event.ID,
			ClassTime:         classTime,
			Date:              occDateStr,
			AttendanceRecords: attendanceByDate[occDateStr],
			IsCancelled:       isCancelled,
			IsRescheduled:     isRescheduled,
		}
		if isCancelled {
			eventInstance.OverrideID = overrideID
		}
		if isCancelled && isRescheduled {
			// Find the final reschedule target by following the chain.
			// Simple case: non-cancelled override linked to this cancel (A→B).
			// Chain case: cancelled override linked to this cancel (A→B→C),
			// then follow B's cancel to find C's non-cancelled reschedule target.
			currentID := overrideID
			visited := map[uint]bool{currentID: true}
			for {
				foundTarget := false
				// Look for non-cancelled reschedule target linked to currentID
				for _, other := range event.Overrides {
					if !other.IsCancelled && other.LinkedOverrideEventID != nil && *other.LinkedOverrideEventID == currentID {
						rRule, err := rrule.StrToRRule(other.OverrideRrule)
						if err == nil && len(rRule.All()) > 0 {
							eventInstance.RescheduledToDate = rRule.All()[0].In(loc).Format("2006-01-02")
						}
						foundTarget = true
						break
					}
				}
				if foundTarget {
					break
				}
				// No non-cancelled target found — look for a cancelled intermediate
				// (chain case: B was re-rescheduled, so B's override is now cancelled)
				nextID := uint(0)
				for _, other := range event.Overrides {
					if other.IsCancelled && other.LinkedOverrideEventID != nil && *other.LinkedOverrideEventID == currentID && !visited[other.ID] {
						nextID = other.ID
						break
					}
				}
				if nextID == 0 {
					break
				}
				visited[nextID] = true
				currentID = nextID
			}
		}
		eventInstances = append(eventInstances, eventInstance)
	}
	// Build a map of non-cancelled, non-reschedule overrides (room/instructor/time changes)
	// keyed by date string so we can apply them to base occurrences
	sameDateOverrides := make(map[string]models.ProgramClassEventOverride)
	for _, override := range event.Overrides {
		isReschedule := override.LinkedOverrideEventID != nil && *override.LinkedOverrideEventID != override.ID
		if override.IsCancelled || isReschedule {
			continue
		}
		parsedRule, err := rrule.StrToRRule(override.OverrideRrule)
		if err != nil || len(parsedRule.All()) == 0 {
			continue
		}
		dateStr := parsedRule.All()[0].In(loc).Format("2006-01-02")
		sameDateOverrides[dateStr] = override
	}
	// Apply room/instructor/time overrides to existing base instances
	for i := range eventInstances {
		if sdOverride, ok := sameDateOverrides[eventInstances[i].Date]; ok {
			parsedRule, _ := rrule.StrToRRule(sdOverride.OverrideRrule)
			overrideDate := parsedRule.All()[0]
			duration, err := time.ParseDuration(sdOverride.Duration)
			if err == nil {
				overrideEnd := overrideDate.Add(duration)
				eventInstances[i].ClassTime = overrideDate.In(loc).Format("15:04") + "-" + overrideEnd.In(loc).Format("15:04")
			}
			eventInstances[i].OverrideID = sdOverride.ID
		}
	}
	// Index existing instances by date for dedup
	instanceByDate := make(map[string]int, len(eventInstances))
	for i, inst := range eventInstances {
		instanceByDate[inst.Date] = i
	}
	// Add rescheduled sessions (overrides with LinkedOverrideEventID pointing to a different override).
	// Includes both non-cancelled targets (normal reschedule) and cancelled targets
	// (Scenario 1: B was rescheduled from A, then B was cancelled — B is both a
	// reschedule target and cancelled, needs to show as "Cancelled + Rescheduled Class").
	for _, override := range event.Overrides {
		isReschedule := override.LinkedOverrideEventID != nil && *override.LinkedOverrideEventID != override.ID
		if !isReschedule {
			continue
		}
		parsedRule, err := rrule.StrToRRule(override.OverrideRrule)
		if err != nil {
			logrus.Warnf("unable to parse reschedule override rule: %s", override.OverrideRrule)
			continue
		}
		allOccs := parsedRule.All()
		if len(allOccs) == 0 {
			logrus.Warnf("cancelled override rule does not contain a date instance, rule is: %s", override.OverrideRrule)
			continue
		}
		overrideDate := allOccs[0]
		overrideDateStr := overrideDate.In(loc).Format("2006-01-02")

		duration, err := time.ParseDuration(override.Duration)
		if err != nil {
			logrus.Errorf("error parsing duration for event: %v", err)
		}
		overrideEnd := overrideDate.Add(duration)
		overrideClassTime := overrideDate.In(loc).Format("15:04") + "-" + overrideEnd.In(loc).Format("15:04")

		rescheduledFromDate := ""
		for _, other := range event.Overrides {
			if other.ID == *override.LinkedOverrideEventID && other.IsCancelled {
				otherRule, err := rrule.StrToRRule(other.OverrideRrule)
				if err == nil && len(otherRule.All()) > 0 {
					rescheduledFromDate = otherRule.All()[0].In(loc).Format("2006-01-02")
				}
				break
			}
		}
		rescheduledInstance := models.ClassEventInstance{
			EventID:             event.ID,
			ClassTime:           overrideClassTime,
			Date:                overrideDateStr,
			AttendanceRecords:   attendanceByDate[overrideDateStr],
			IsCancelled:         override.IsCancelled,
			RescheduledFromDate: rescheduledFromDate,
			OverrideID:          override.ID,
		}
		if existingIdx, exists := instanceByDate[overrideDateStr]; exists {
			existingInst := eventInstances[existingIdx]
			if existingInst.IsCancelled || override.IsCancelled || existingInst.ClassTime == overrideClassTime {
				// Replace when: the existing is cancelled, the override is cancelled,
				// or both have the same time (same session slot, just add reschedule info)
				eventInstances[existingIdx] = rescheduledInstance
			} else {
				// Both are active sessions on the same date at DIFFERENT times
				// (e.g., a 9am session + a 2pm session rescheduled to the same day).
				eventInstances = append(eventInstances, rescheduledInstance)
			}
		} else {
			instanceByDate[overrideDateStr] = len(eventInstances)
			eventInstances = append(eventInstances, rescheduledInstance)
		}
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
		dtstart := rule.GetDTStart()
		canonicalHour = dtstart.Hour()
		canonicalMinute = dtstart.Minute()
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
