package services

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"fmt"
	"sort"
	"time"
)

type ClassesService struct {
	db *database.DB
}

func NewClassesService(db *database.DB) *ClassesService {
	return &ClassesService{db: db}
}

// duplicate, but will remove once we fully removed all business logic from database layer
func getCanonicalHourAndMinute(occurrences []time.Time, timezone string) (int, int) {
	if len(occurrences) == 0 {
		return 0, 0
	}
	firstOccurrence := occurrences[0]
	userLocation, err := time.LoadLocation(timezone)
	if err != nil {
		return firstOccurrence.Hour(), firstOccurrence.Minute()
	}
	localTime := firstOccurrence.In(userLocation)
	return localTime.Hour(), localTime.Minute()
}

func (svc *ClassesService) GetMissingAttendanceForFacility(args *models.QueryContext, facilityID *uint, days int) ([]models.MissingAttendanceItem, error) {
	if days <= 0 {
		days = 3
	}
	classes, err := svc.db.GetActiveClassesForMissingAttendance(args, facilityID)
	if err != nil {
		return nil, err
	}
	if len(classes) == 0 {
		return []models.MissingAttendanceItem{}, nil
	}

	loc, err := time.LoadLocation(args.Timezone)
	if err != nil {
		loc = time.UTC
	}
	nowLocal := time.Now().In(loc)
	startDate := time.Now().In(loc).AddDate(0, 0, -days).Truncate(24 * time.Hour)
	endDate := time.Now().In(loc).AddDate(0, 0, 1).Truncate(24 * time.Hour)

	classIDs := make([]uint, 0, len(classes))
	classByID := make(map[uint]models.MissingAttendanceClass, len(classes))
	for _, cls := range classes {
		classIDs = append(classIDs, cls.ID)
		classByID[cls.ID] = cls
	}

	events, err := svc.db.GetClassEventsWithOverrides(args, classIDs)
	if err != nil {
		return nil, err
	}

	type eventInstance struct {
		models.EventInstance
		DateKey string
	}
	instances := make([]eventInstance, 0)
	eventIDSet := make(map[uint]struct{})
	dateSet := make(map[string]struct{})

	for _, event := range events {
		rule, err := event.GetRRuleWithTimezone(args.Timezone)
		if err != nil {
			continue
		}
		firstOccurrence := rule.After(time.Time{}, false)
		canonicalHour, canonicalMinute := getCanonicalHourAndMinute([]time.Time{firstOccurrence}, args.Timezone)
		eventInstances := database.GenerateEventInstances(event, startDate, endDate)
		for _, inst := range eventInstances {
			if inst.IsCancelled {
				continue
			}
			localStart := inst.StartTime.In(loc)
			consistentOccurrence := time.Date(
				localStart.Year(),
				localStart.Month(),
				localStart.Day(),
				canonicalHour,
				canonicalMinute,
				0,
				0,
				loc,
			).UTC()
			if consistentOccurrence.After(nowLocal) {
				continue
			}
			inst.StartTime = consistentOccurrence
			dateKey := consistentOccurrence.In(loc).Format("2006-01-02")
			instances = append(instances, eventInstance{
				EventInstance: inst,
				DateKey:       dateKey,
			})
			eventIDSet[inst.EventID] = struct{}{}
			dateSet[dateKey] = struct{}{}
		}
	}
	if len(instances) == 0 {
		return []models.MissingAttendanceItem{}, nil
	}

	eventIDs := make([]uint, 0, len(eventIDSet))
	for id := range eventIDSet {
		eventIDs = append(eventIDs, id)
	}
	dates := make([]string, 0, len(dateSet))
	for date := range dateSet {
		dates = append(dates, date)
	}

	attendanceCounts, err := svc.db.GetAttendanceCountsForEvents(args, eventIDs, dates)
	if err != nil {
		return nil, err
	}
	attendanceMap := make(map[string]int64, len(attendanceCounts))
	for _, attendance := range attendanceCounts {
		key := fmt.Sprintf("%d_%s", attendance.EventID, attendance.Date)
		attendanceMap[key] = attendance.Count
	}

	type enrollmentWindow struct {
		EnrolledAt        *time.Time
		EnrollmentEndedAt *time.Time
	}
	enrollments, err := svc.db.GetActiveEnrollmentsForClasses(args, classIDs)
	if err != nil {
		return nil, err
	}
	enrollmentsByClass := make(map[uint][]enrollmentWindow, len(classIDs))
	for _, enrollment := range enrollments {
		enrollmentsByClass[enrollment.ClassID] = append(enrollmentsByClass[enrollment.ClassID], enrollmentWindow{
			EnrolledAt:        enrollment.EnrolledAt,
			EnrollmentEndedAt: enrollment.EnrollmentEndedAt,
		})
	}

	items := make([]models.MissingAttendanceItem, 0)
	for _, inst := range instances {
		enrolledCountOnDate := 0
		for _, enrollment := range enrollmentsByClass[inst.ClassID] {
			if enrollment.EnrolledAt == nil {
				continue
			}
			if !enrollment.EnrolledAt.After(inst.StartTime) &&
				(enrollment.EnrollmentEndedAt == nil || enrollment.EnrollmentEndedAt.After(inst.StartTime.AddDate(0, 0, -1))) {
				enrolledCountOnDate++
			}
		}
		if enrolledCountOnDate == 0 {
			continue
		}
		key := fmt.Sprintf("%d_%s", inst.EventID, inst.DateKey)
		attendanceCount := attendanceMap[key]
		if int(attendanceCount) == enrolledCountOnDate {
			continue
		}
		classInfo := classByID[inst.ClassID]
		items = append(items, models.MissingAttendanceItem{
			ClassID:      inst.ClassID,
			ClassName:    classInfo.Name,
			FacilityName: classInfo.FacilityName,
			EventID:      inst.EventID,
			Date:         inst.DateKey,
			StartTime:    inst.StartTime.In(loc).Format("15:04"),
		})
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].Date == items[j].Date {
			return items[i].StartTime > items[j].StartTime
		}
		return items[i].Date > items[j].Date
	})

	return items, nil
}
