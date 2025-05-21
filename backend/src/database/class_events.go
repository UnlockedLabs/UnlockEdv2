package database

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/models"
	"fmt"
	"slices"
	"sort"
	"strconv"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/teambition/rrule-go"
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
	events := []models.FacilityProgramClassEvent{}
	tx := db.WithContext(args.Ctx).Table("program_class_events pcev").
		Select(`pcev.*,
		c.instructor_name,
		c.name as class_name,
		CASE WHEN c.status = 'Cancelled' THEN TRUE ELSE FALSE END as is_cancelled,
		ARRAY_AGG(DISTINCT CONCAT(u.id, ':', u.name_first, ' ', u.name_last)) FILTER (WHERE e.enrollment_status = 'Enrolled') AS enrolled_users`).
		Joins("JOIN program_classes c ON c.id = pcev.class_id").
		Joins("LEFT JOIN program_class_enrollments e ON e.class_id = c.id AND e.enrollment_status = 'Enrolled'").
		Joins("LEFT JOIN users u ON e.user_id = u.id").
		Where("c.facility_id = ?", args.FacilityID).
		Group("pcev.id, c.instructor_name, c.name, c.status")
	if err := tx.Scan(&events).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_events")
	}
	var facilityEvents []models.FacilityProgramClassEvent
	for _, event := range events {
		rRule, err := event.GetRRule()
		if err != nil {
			return nil, err
		}
		if dtRng.Start.IsZero() {
			dtRng.Start = time.Now()
		}
		if dtRng.End.IsZero() {
			dtRng.End = time.Now().AddDate(0, 1, 0)
		}
		occurrences := rRule.Between(dtRng.Start, dtRng.End, true)
		duration, err := time.ParseDuration(event.Duration)
		if err != nil {
			return nil, err
		}
		for _, occurrence := range occurrences {
			facilityEvent := models.FacilityProgramClassEvent{
				ProgramClassEvent: event.ProgramClassEvent,
				InstructorName:    event.InstructorName,
				ClassName:         event.ClassName,
				IsCancelled:       event.IsCancelled,
				EnrolledUsers:     event.EnrolledUsers,
				StartTime:         occurrence,
				EndTime:           occurrence.Add(duration),
				Frequency:         rRule.OrigOptions.Freq.String(),
			}
			facilityEvents = append(facilityEvents, facilityEvent)
		}
	}
	return facilityEvents, nil
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

	var instances []models.ClassEventInstance

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
	classTime := fmt.Sprintf("%s-%s", startTimeStr, endTimeStr)
	var attendances []models.ProgramClassEventAttendance

	if err := db.WithContext(qryCtx.Ctx).
		Model(&models.ProgramClassEventAttendance{}).
		Where("event_id = ? AND date BETWEEN SYMMETRIC ? AND ?", event.ID, occDateStr, lastOccDateStr).
		Order("date DESC").
		Find(&attendances).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_event_attendances")
	}

	for _, occ := range occurrences {
		occInLoc := occ.In(loc)
		occDateStr := occInLoc.Format("2006-01-02")

		relevantAttendance := src.FilterMap(attendances, func(att models.ProgramClassEventAttendance) bool {
			return att.Date == occDateStr
		})

		instance := models.ClassEventInstance{
			EventID:           event.ID,
			ClassTime:         classTime,
			Date:              occDateStr,
			AttendanceRecords: relevantAttendance,
		}
		instances = append(instances, instance)
	}
	slices.Reverse(instances)

	qryCtx.Total = int64(len(instances))

	offset := qryCtx.CalcOffset()
	end := offset + qryCtx.PerPage
	if offset >= len(instances) {
		instances = []models.ClassEventInstance{}
	} else if end > len(instances) {
		instances = instances[offset:]
	} else {
		instances = instances[offset:end]
	}

	return instances, nil
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
