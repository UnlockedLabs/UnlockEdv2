package database

import (
	"UnlockEdv2/src/models"
	"sort"
	"time"

	"github.com/teambition/rrule-go"
)

func (db *DB) GetRoomsForFacility(facilityID uint) ([]models.Room, error) {
	var rooms []models.Room
	if err := db.Where("facility_id = ?", facilityID).Order("name ASC").Find(&rooms).Error; err != nil {
		return nil, newGetRecordsDBError(err, "rooms")
	}
	return rooms, nil
}

func (db *DB) GetRoomByID(roomID uint) (*models.Room, error) {
	var room models.Room
	if err := db.First(&room, roomID).Error; err != nil {
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

func (db *DB) UpdateRoom(roomID uint, updates map[string]interface{}) error {
	if err := db.Model(&models.Room{}).Where("id = ?", roomID).Updates(updates).Error; err != nil {
		return newUpdateDBError(err, "room")
	}
	return nil
}

func (db *DB) DeleteRoom(roomID uint) error {
	if err := db.Delete(&models.Room{}, roomID).Error; err != nil {
		return newDeleteDBError(err, "room")
	}
	return nil
}

func (db *DB) CheckRRuleConflicts(req *models.ConflictCheckRequest) ([]models.RoomConflict, error) {
	rule, err := rrule.StrToRRule(req.RecurrenceRule)
	if err != nil {
		return nil, NewDBError(err, "invalid recurrence rule")
	}

	duration, err := time.ParseDuration(req.Duration)
	if err != nil {
		return nil, NewDBError(err, "invalid duration")
	}

	dtStart := rule.GetDTStart()
	until := rule.GetUntil()
	if until.IsZero() {
		until = dtStart.AddDate(2, 0, 0)
	}

	bookings, err := db.GetRoomBookingsInRange(req.FacilityID, req.RoomID, dtStart, until)
	if err != nil {
		return nil, err
	}

	occurrences := rule.Between(dtStart, until, true)
	var conflicts []models.RoomConflict

	for _, occ := range occurrences {
		endTime := occ.Add(duration)
		for _, booking := range bookings {
			if req.ExcludeEventID != nil && booking.EventID == *req.ExcludeEventID {
				continue
			}
			if hasTimeOverlap(occ, endTime, booking.StartTime, booking.EndTime) {
				conflict := models.RoomConflict{
					ConflictingEventID: booking.EventID,
					ConflictingClassID: booking.ClassID,
					StartTime:          booking.StartTime,
					EndTime:            booking.EndTime,
				}
				conflicts = append(conflicts, conflict)
				return conflicts, nil
			}
		}
	}

	return conflicts, nil
}

func (db *DB) GetRoomBookingsInRange(facilityID, roomID uint, rangeStart, rangeEnd time.Time) ([]models.RoomBooking, error) {
	var events []models.ProgramClassEvent
	if err := db.Table("program_class_events e").
		Select("e.*").
		Joins("JOIN program_classes c ON c.id = e.class_id").
		Where("c.facility_id = ? AND e.room_id = ? AND e.deleted_at IS NULL", facilityID, roomID).
		Preload("Overrides").
		Find(&events).Error; err != nil {
		return nil, newGetRecordsDBError(err, "program_class_events")
	}

	var bookings []models.RoomBooking
	for _, event := range events {
		eventBookings := expandEventToBookings(event, rangeStart, rangeEnd, roomID)
		bookings = append(bookings, eventBookings...)
	}
	return bookings, nil
}

func expandEventToBookings(event models.ProgramClassEvent, rangeStart, rangeEnd time.Time, targetRoomID uint) []models.RoomBooking {
	var bookings []models.RoomBooking

	rule, err := event.GetRRule()
	if err != nil {
		return bookings
	}

	duration, err := time.ParseDuration(event.Duration)
	if err != nil {
		duration = time.Hour
	}

	cancelledDates := make(map[string]bool)
	rescheduledDates := make(map[string]models.ProgramClassEventOverride)
	for _, override := range event.Overrides {
		overrideRule, err := rrule.StrToRRule(override.OverrideRrule)
		if err != nil {
			continue
		}
		for _, occ := range overrideRule.All() {
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

	return bookings
}

func hasTimeOverlap(start1, end1, start2, end2 time.Time) bool {
	return start1.Before(end2) && start2.Before(end1)
}
