package database

import (
	"UnlockEdv2/src/models"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/teambition/rrule-go"
)

func (db *DB) GetRoomsForFacility(facilityID uint) ([]models.Room, error) {
	var rooms []models.Room
	if err := db.Where("facility_id = ?", facilityID).Order("name ASC").Find(&rooms).Error; err != nil {
		return nil, newGetRecordsDBError(err, "rooms")
	}
	return rooms, nil
}

func (db *DB) GetRoomByIDForFacility(roomID, facilityID uint) (*models.Room, error) {
	var room models.Room
	if err := db.Where("id = ? AND facility_id = ?", roomID, facilityID).First(&room).Error; err != nil {
		return nil, newNotFoundDBError(err, "rooms")
	}
	return &room, nil
}

func (db *DB) CreateRoom(room *models.Room) (*models.Room, error) {
	if err := Validate().Struct(room); err != nil {
		return nil, newCreateDBError(err, "room")
	}
	if err := db.Create(room).Error; err != nil {
		return nil, newCreateDBError(err, "room")
	}
	return room, nil
}

const maxConflictsToReturn = 50

func (db *DB) CheckRRuleConflicts(req *models.ConflictCheckRequest) ([]models.RoomConflict, error) {
	if req.RecurrenceRule == "" {
		return nil, NewDBError(errors.New("recurrence rule is required"), "invalid conflict check request")
	}
	if req.Duration == "" {
		return nil, NewDBError(errors.New("duration is required"), "invalid conflict check request")
	}

	var facility models.Facility
	if err := db.Select("timezone").First(&facility, req.FacilityID).Error; err != nil {
		return nil, newGetRecordsDBError(err, "facility")
	}

	tempEvent := &models.ProgramClassEvent{RecurrenceRule: req.RecurrenceRule}
	rule, err := tempEvent.GetRRuleWithTimezone(facility.Timezone)
	if err != nil {
		return nil, NewDBError(err, "invalid recurrence rule")
	}

	duration, err := time.ParseDuration(req.Duration)
	if err != nil {
		return nil, NewDBError(err, "invalid duration")
	}

	now := time.Now()
	rangeStart := rule.GetDTStart()
	if rangeStart.Before(now.AddDate(-1, 0, 0)) {
		rangeStart = now.AddDate(-1, 0, 0)
	}
	until := rule.GetUntil()
	if until.IsZero() || until.Before(rangeStart) {
		until = rangeStart.AddDate(1, 0, 0)
	}
	if until.After(rangeStart.AddDate(1, 0, 0)) {
		until = rangeStart.AddDate(1, 0, 0)
	}

	bookings, err := db.getRoomBookingsInRange(req.FacilityID, req.RoomID, rangeStart, until, facility.Timezone)
	if err != nil {
		return nil, err
	}

	occurrences := rule.Between(rangeStart, until, true)
	var conflicts []models.RoomConflict

	classIDs := make(map[uint]struct{})
	for _, booking := range bookings {
		classIDs[booking.ClassID] = struct{}{}
	}

	classNamesCache := make(map[uint]string)
	if len(classIDs) > 0 {
		ids := make([]uint, 0, len(classIDs))
		for id := range classIDs {
			ids = append(ids, id)
		}
		var classes []models.ProgramClass
		if err := db.Select("id, name").Where("id IN ?", ids).Find(&classes).Error; err != nil {
			logrus.Warnf("failed to batch fetch class names for conflict display: %v", err)
		}
		for _, c := range classes {
			classNamesCache[c.ID] = c.Name
		}
	}

	for _, occ := range occurrences {
		if len(conflicts) >= maxConflictsToReturn {
			break
		}
		endTime := occ.Add(duration)
		for _, booking := range bookings {
			if req.ExcludeEventID != nil && booking.EventID == *req.ExcludeEventID {
				continue
			}
			if hasTimeOverlap(occ, endTime, booking.StartTime, booking.EndTime) {
				className := classNamesCache[booking.ClassID]
				if className == "" {
					className = "Unknown Class"
				}

				conflict := models.RoomConflict{
					ConflictingEventID: booking.EventID,
					ConflictingClassID: booking.ClassID,
					ClassName:          className,
					StartTime:          booking.StartTime,
					EndTime:            booking.EndTime,
				}
				conflicts = append(conflicts, conflict)
				if len(conflicts) >= maxConflictsToReturn {
					break
				}
			}
		}
	}

	return conflicts, nil
}

func (db *DB) getRoomBookingsInRange(facilityID, roomID uint, rangeStart, rangeEnd time.Time, facilityTimezone string) ([]models.RoomBooking, error) {
	var events []models.ProgramClassEvent
	if err := db.Table("program_class_events e").
		Select("DISTINCT e.*").
		Joins("JOIN program_classes c ON c.id = e.class_id").
		Joins("LEFT JOIN program_class_event_overrides o ON o.event_id = e.id AND o.deleted_at IS NULL").
		Where("c.facility_id = ? AND e.deleted_at IS NULL AND (e.room_id = ? OR o.room_id = ?)", facilityID, roomID, roomID).
		Preload("Overrides").
		Find(&events).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_events")
	}

	var bookings []models.RoomBooking
	for _, event := range events {
		eventBookings, err := expandEventToBookings(event, rangeStart, rangeEnd, roomID, facilityTimezone)
		if err != nil {
			return nil, err
		}
		bookings = append(bookings, eventBookings...)
	}
	return bookings, nil
}

func expandEventToBookings(event models.ProgramClassEvent, rangeStart, rangeEnd time.Time, targetRoomID uint, facilityTimezone string) ([]models.RoomBooking, error) {
	var bookings []models.RoomBooking

	if event.RoomID == nil {
		return bookings, nil
	}

	rule, err := event.GetRRuleWithTimezone(facilityTimezone)
	if err != nil {
		return nil, fmt.Errorf("invalid recurrence rule for event %d: %w", event.ID, err)
	}

	duration, err := time.ParseDuration(event.Duration)
	if err != nil {
		return nil, fmt.Errorf("invalid duration '%s' for event %d: %w", event.Duration, event.ID, err)
	}

	cancelledDates := make(map[string]bool)
	rescheduledDates := make(map[string]models.ProgramClassEventOverride)
	for _, override := range event.Overrides {
		overrideRule, err := rrule.StrToRRule(override.OverrideRrule)
		if err != nil {
			logrus.Warnf("skipping override %d with invalid rrule: %v", override.ID, err)
			continue
		}
		overrideOccurrences := overrideRule.Between(rangeStart, rangeEnd, true)
		for _, occ := range overrideOccurrences {
			dateKey := occ.Format("2006-01-02")
			if override.IsCancelled {
				cancelledDates[dateKey] = true
			} else {
				rescheduledDates[dateKey] = override
			}
		}
	}

	occurrences := rule.Between(rangeStart, rangeEnd, true)
	for _, occ := range occurrences {
		dateKey := occ.Format("2006-01-02")
		if cancelledDates[dateKey] {
			continue
		}
		if _, rescheduled := rescheduledDates[dateKey]; rescheduled {
			continue
		}
		if *event.RoomID != targetRoomID {
			continue
		}
		bookings = append(bookings, models.RoomBooking{
			RoomID:     *event.RoomID,
			StartTime:  occ,
			EndTime:    occ.Add(duration),
			EventID:    event.ID,
			ClassID:    event.ClassID,
			IsOverride: false,
		})
	}

	for _, override := range event.Overrides {
		if override.IsCancelled {
			continue
		}
		overrideRoomID := event.RoomID
		if override.RoomID != nil {
			overrideRoomID = override.RoomID
		}
		if overrideRoomID == nil || *overrideRoomID != targetRoomID {
			continue
		}
		overrideRule, err := rrule.StrToRRule(override.OverrideRrule)
		if err != nil {
			logrus.Warnf("skipping override %d with invalid rrule: %v", override.ID, err)
			continue
		}
		overrideDuration, err := time.ParseDuration(override.Duration)
		if err != nil {
			overrideDuration = duration
		}
		for _, occ := range overrideRule.Between(rangeStart, rangeEnd, true) {
			bookings = append(bookings, models.RoomBooking{
				RoomID:     *overrideRoomID,
				StartTime:  occ,
				EndTime:    occ.Add(overrideDuration),
				EventID:    event.ID,
				ClassID:    event.ClassID,
				IsOverride: true,
			})
		}
	}

	sort.Slice(bookings, func(i, j int) bool {
		return bookings[i].StartTime.Before(bookings[j].StartTime)
	})

	return bookings, nil
}

func hasTimeOverlap(start1, end1, start2, end2 time.Time) bool {
	return start1.Before(end2) && start2.Before(end1)
}
