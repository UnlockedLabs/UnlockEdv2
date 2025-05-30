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
)

/*
Everything stored in database will ALWAYS be in UTC
and converted when returning to the client
*/

func (db *DB) GetClassEvents(page, perPage, classId int) (int64, []models.ProgramClassEvent, error) {
	content := []models.ProgramClassEvent{}
	total := int64(0)
	if err := db.Model(&models.ProgramClassEvent{}).Preload("Overrides").Find(&content).Count(&total).
		Limit(perPage).Offset(calcOffset(page, perPage)).Error; err != nil {
		return 0, nil, newGetRecordsDBError(err, "program_class_events")
	}
	return total, content, nil
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

func (db *DB) CreateOverrideEvents(ctx *models.QueryContext, overrideEvents []*models.ProgramClassEventOverride) error {
	trans := db.WithContext(ctx.Ctx).Begin() //only need to pass context here, it will be used/shared within the transaction
	if trans.Error != nil {
		return NewDBError(trans.Error, "unable to start the database transaction")
	}

	var (
		changeLogEntry *models.ChangeLogEntry
		eventDate      *string
		err            error
	)

	changeLogEntry = models.NewChangeLogEntry("program_classes", "", nil, nil, 0, ctx.UserID)
	for _, overrideEvent := range overrideEvents {
		if err := trans.Create(overrideEvent).Error; err != nil {
			trans.Rollback()
			return newCreateDBError(err, "program_class_event_overrides")
		}

		if overrideEvent.IsCancelled && len(overrideEvents) < 2 { //only add log for cancelled event
			eventDate, err = overrideEvent.GetFormattedCancelledDate("2006-01-02")
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
			eventDate, err = overrideEvent.GetFormattedCancelledDate("2006-01-02")
			if err != nil {
				trans.Rollback()
				return NewDBError(err, "unable to parse override date")
			}
			changeLogEntry.OldValue = &overrideEvent.OverrideRrule
		}
		if overrideEvent.IsCancelled { //delete attendance
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

type ProgramData struct {
	ProgramID          uint                                 `json:"program_id"`
	ProgramName        string                               `json:"program_name"`
	ClassID            uint                                 `json:"class_id"`
	TotalEvents        int                                  `json:"total_events"`
	AttendedEvents     int                                  `json:"attended_events"`
	PercentageComplete float64                              `json:"percentage_complete"`
	EventsLeft         int                                  `json:"events_left"`
	AttendanceRecords  []models.ProgramClassEventAttendance `json:"attendance_records"`
}

func (db *DB) GetStudentProgramAttendanceData(userId uint) ([]ProgramData, error) {
	//  err := db.Table("program_class_enrollments pse").
	// Select(`ps.program_id,
	//    p.name AS program_name,
	//    ps.id AS class_id,
	//    COUNT(DISTINCT e.id) AS total_events,
	//    COUNT(DISTINCT a.event_id) AS attended_events,
	//    (COUNT(DISTINCT a.event_id) * 100.0 / COUNT(DISTINCT e.id)) AS percentage_complete`).
	// 	Joins(`JOIN
	//    program_classes ps ON pse.class_id = ps.id`).
	// 	Joins(`JOIN
	//    programs p ON ps.program_id = p.id`).
	// 	Joins(`JOIN
	//    program_class_events e ON e.class_id = ps.id`).
	// 	Joins(`LEFT JOIN program_class_event_attendances a ON a.event_id = e.id AND a.user_id = pse.user_id`).Where(`pse.user_id = ?`, userId).Group(`ps.program_id, ps.id, p.name`).
	// Error
	//    if err != nil {
	// 	return nil, newGetRecordsDBError(err, "program_class_enrollments")
	// }
	var programDataList []ProgramData

	var enrollments []models.ProgramClassEnrollment
	if err := db.Where("user_id = ?", userId).Find(&enrollments).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_enrollments")
	}

	if len(enrollments) == 0 {
		logrus.Tracef("User is not enrolled in any programs.")
		return []ProgramData{}, nil
	}

	programDataMap := make(map[uint]*ProgramData) // key: sec id

	for _, enrollment := range enrollments {
		class := models.ProgramClass{}
		if err := db.Preload("Program").First(&class, enrollment.ClassID).Error; err != nil {
			return nil, newGetRecordsDBError(err, "program_classes")
		}
		programData := &ProgramData{
			ProgramID:   class.ProgramID,
			ProgramName: class.Program.Name,
			ClassID:     class.ID,
		}
		var events []models.ProgramClassEvent
		if err := db.Preload("Overrides").Where("class_id = ?", class.ID).Find(&events).Error; err != nil {
			return nil, newGetRecordsDBError(err, "program_class_events")
		}
		totalScheduledEvents := 0
		upcomingEvents := 0
		now := time.Now().UTC()
		for _, event := range events {
			eventRule, err := event.GetRRule()
			if err != nil {
				logrus.Errorf("Failed to parse RRULE for event ID %d: %v", event.ID, err)
				continue
			}
			eventDtstart := eventRule.OrigOptions.Dtstart
			logrus.Infof("Event ID %d: Dtstart = %s", event.ID, eventDtstart)
			startDate := eventDtstart.UTC()
			eventInstances := generateEventInstances(event, startDate, now)
			totalScheduledEvents += len(eventInstances)

			occurrences := eventRule.Between(startDate, now, true)
			logrus.Infof("Event ID %d: Generated %d occurrences directly from RRULE", event.ID, len(occurrences))

			logrus.Debugf("Event ID %d: Generated %d past instances", event.ID, len(eventInstances))

			futureEventInstances := generateEventInstances(event, now, now.AddDate(1, 0, 0))
			upcomingEvents += len(futureEventInstances)
			totalScheduledEvents += len(futureEventInstances)
			logrus.Debugf("Event ID %d: Generated %d future instances", event.ID, len(futureEventInstances))
		}

		programData.TotalEvents = totalScheduledEvents
		programData.EventsLeft = upcomingEvents

		var attendanceRecords []models.ProgramClassEventAttendance
		if err := db.Preload("Event").Where("user_id = ? AND event_id IN (?)",
			userId, db.Model(&models.ProgramClassEvent{}).Select("id").Where("class_id = ?", class.ID),
		).Find(&attendanceRecords).Error; err != nil {
			return nil, newGetRecordsDBError(err, "program_class_event_attendances")
		}

		programData.AttendanceRecords = attendanceRecords
		programData.AttendedEvents = len(attendanceRecords)

		if totalScheduledEvents > 0 {
			programData.PercentageComplete = (float64(programData.AttendedEvents) / float64(totalScheduledEvents)) * 100
		} else {
			programData.PercentageComplete = 0
		}

		programDataMap[class.ID] = programData
	}
	for _, data := range programDataMap {
		programDataList = append(programDataList, *data)
	}
	return programDataList, nil
}

func (db *DB) getCalendarFromEvents(events []models.ProgramClassEvent, rng *models.DateRange) (*models.Calendar, error) {
	daysMap := make(map[string]*models.Day)
	currentDate := rng.Start
	for !currentDate.After(rng.End) {
		dateStr := currentDate.Format("2006-01-02")
		daysMap[dateStr] = &models.Day{
			DayIdx: currentDate.Day(),
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

		eventInstances := generateEventInstances(event, rng.Start, rng.End.Add(time.Duration(24*time.Hour-1)))

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
			if instance.Room == "" {
				instance.Room = event.Room
			}
			instance.ProgramName = event.Class.Program.Name
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
	return models.NewCalendar(days), nil
}

func (db *DB) GetFacilityCalendar(args *models.QueryContext, dtRng *models.DateRange) ([]models.FacilityProgramClassEvent, error) {
	events := make([]models.FacilityProgramClassEvent, 0, 10)
	// TO DO: finish adding overrides as is_cancelled (so it renders in the frontend)
	tx := db.WithContext(args.Ctx).Table("program_class_events pcev").
		Select(`pcev.*,
		p.name as program_name,
		c.instructor_name,
		c.name as class_name,
        STRING_AGG(CONCAT(u.id, ':', u.name_last, ', ', u.name_first), '|' ORDER BY u.name_last) FILTER (WHERE e.enrollment_status = 'Enrolled') AS enrolled_users`).
		Joins("JOIN program_classes c ON c.id = pcev.class_id").
		Joins("JOIN programs p ON p.id = c.program_id").
		Joins("LEFT JOIN program_class_enrollments e ON e.class_id = c.id").
		Joins("LEFT JOIN users u ON e.user_id = u.id").
		Where("c.facility_id = ?", args.FacilityID).
		Group("pcev.id, c.instructor_name, c.name, p.name")
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
		var isCancelled, isRescheduled bool
		for _, occurrence := range occurrences {
			isCancelled, isRescheduled = checkEventCancelledAndRescheduled(occurrence, overrides)

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
			}
			facilityEvents = append(facilityEvents, facilityEvent)
		}

		for _, override := range overrides { //adding the rescheduled ones to instances slice
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
			duration, err := time.ParseDuration(override.Duration)
			if err != nil {
				logrus.Errorf("error parsing duration for event: %v", err)
			}
			overrideEndTime := overrideDate.Add(duration)
			facilityEvent := models.FacilityProgramClassEvent{
				ProgramClassEvent: event.ProgramClassEvent,
				InstructorName:    event.InstructorName,
				ProgramName:       event.ProgramName,
				ClassName:         event.ClassName,
				EnrolledUsers:     event.EnrolledUsers,
				StartTime:         &overrideDate,
				EndTime:           &overrideEndTime,
				Frequency:         rRule.OrigOptions.Freq.String(),
				IsOverride:        true,
			}
			facilityEvents = append(facilityEvents, facilityEvent)
		}
	}
	slices.SortFunc(facilityEvents, func(a, b models.FacilityProgramClassEvent) int {
		return b.StartTime.Compare(*a.StartTime)
	})

	return facilityEvents, nil
}

func checkEventCancelledAndRescheduled(occurrence time.Time, overrides []models.ProgramClassEventOverride) (bool, bool) {
	var (
		isCancelled   = false
		isRescheduled = false
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
			break
		}
	}
	return isCancelled, isRescheduled
}

func (db *DB) GetCalendar(dtRng *models.DateRange, userId *uint) (*models.Calendar, error) {
	content := []models.ProgramClassEvent{}
	tx := db.Model(&models.ProgramClassEvent{}).
		Joins("JOIN program_classes c ON c.id = program_class_events.class_id").
		Joins("JOIN programs p ON p.id = c.program_id").
		Joins("JOIN program_class_enrollments e ON e.class_id = c.id AND e.enrollment_status = 'Enrolled'").
		Where("p.archived_at IS NULL AND p.is_active = true").
		Where("c.status IN ('Scheduled', 'Active')")

	if userId != nil {
		tx = tx.Where("e.user_id = ?", userId)
	}

	tx = tx.
		Preload("Overrides").
		Preload("Class", "status IN ('Scheduled','Active')").
		Preload("Class.Program", "programs.archived_at IS NULL AND is_active = true")

	if userId != nil {
		tx = tx.Preload("Class.Enrollments", "user_id = ? AND enrollment_status = 'Enrolled'", *userId)
	}

	if err := tx.Find(&content).Error; err != nil {
		return nil, newGetRecordsDBError(err, "calendar")
	}
	return db.getCalendarFromEvents(content, dtRng)
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
func (db *DB) GetClassEventInstancesWithAttendanceForRecurrence(classId int, qryCtx *models.QueryContext, month, year string) ([]models.ClassEventInstance, error) {
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
		Find(&event).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_events")
	}

	rRule, err := event.GetRRule()
	if err != nil {
		logrus.Errorf("event has invalid rule, event: %v", event)
	}

	var startTime, untilTime time.Time

	if month == "" || year == "" {
		startTime = time.Now().Add(time.Hour * 24 * -14)
		untilTime = startTime.AddDate(0, 1, 0)
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

	if err := db.WithContext(qryCtx.Ctx).
		Model(&models.ProgramClassEventAttendance{}).
		Where("event_id = ? AND date BETWEEN SYMMETRIC ? AND ?", event.ID, occDateStr, lastOccDateStr).
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

		isCancelled, isRescheduled := checkEventCancelledAndRescheduled(occ, event.Overrides)

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

func (db *DB) GetClassEventDatesForRecurrence(classID int, timezone string, month, year string) ([]models.EventDates, error) {
	var event models.ProgramClassEvent
	if err := db.
		Preload("Overrides").
		First(&event, "class_id = ?", classID).Error; err != nil {
		return nil, err
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
	if err := db.WithContext(qryCtx.Ctx).Model(&models.ProgramClassEventOverride{}).Where("event_id IN (?)", eventIDs).Find(&overrides).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_event_overrides")
	}
	return overrides, nil
}
