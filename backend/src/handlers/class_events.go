package handlers

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/models"
	"UnlockEdv2/src/services"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func (srv *Server) registerClassEventsRoutes() []routeDef {
	axx := models.ProgramAccess
	resolver := FacilityAdminResolver("program_classes", "class_id")
	return []routeDef{
		featureRoute("GET /api/student-calendar", srv.handleGetStudentCalendar, axx),
		featureRoute("GET /api/program-classes/{class_id}/events", srv.handleGetProgramClassEvents, axx),
		/* admin */
		adminFeatureRoute("GET /api/admin-calendar", srv.handleGetAdminCalendar, axx),
		adminFeatureRoute("GET /api/program-classes/todays-schedule", srv.handleGetTodaysSchedule, axx),
		adminValidatedFeatureRoute("PUT /api/program-classes/{class_id}/events/{event_id}", srv.handleEventOverrides, axx, resolver),
		adminValidatedFeatureRoute("PATCH /api/program-classes/{class_id}/events/{event_id}", srv.handlePatchEventOverride, axx, resolver),
		adminValidatedFeatureRoute("DELETE /api/program-classes/{class_id}/events/{event_override_id}", srv.handleDeleteEventOverride, axx, resolver),
		adminValidatedFeatureRoute("POST /api/program-classes/{class_id}/events/{event_override_id}/uncancel", srv.handleUncancelOverride, axx, resolver),
		adminValidatedFeatureRoute("POST /api/program-classes/{class_id}/events/{event_id}/uncancel-series", srv.handleUncancelSeries, axx, resolver),
		adminValidatedFeatureRoute("POST /api/program-classes/{class_id}/events", srv.handleCreateEvent, axx, resolver),
		adminValidatedFeatureRoute("PUT /api/program-classes/{class_id}/events", srv.handleRescheduleEventSeries, axx, resolver),
	}
}

func (srv *Server) handleGetAdminCalendar(w http.ResponseWriter, r *http.Request, log sLog) error {
	dtRng, err := getDateRange(r)
	if err != nil {
		return newInvalidQueryParamServiceError(err, "start_dt")
	}
	args := srv.getQueryContext(r)

	id := r.URL.Query().Get("class_id")
	var classID int
	if id != "" {
		classID, err = strconv.Atoi(id)
		if err != nil {
			return newInvalidIdServiceError(err, "class_id")
		}
	}

	events, err := srv.Db.GetFacilityCalendar(&args, dtRng, classID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, events)
}

func (srv *Server) handleGetStudentCalendar(w http.ResponseWriter, r *http.Request, log sLog) error {
	dtRng, err := getDateRange(r)
	if err != nil {
		return newInvalidQueryParamServiceError(err, "start_dt")
	}
	args := srv.getQueryContext(r)
	events, err := srv.Db.GetFacilityCalendar(&args, dtRng, 0)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, events)
}

func (srv *Server) handleGetTodaysSchedule(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := srv.getQueryContext(r)
	facility := r.URL.Query().Get("facility")
	var facilityId *uint
	switch facility {
	case "all":
		facilityId = nil
	default:
		facilityId = &args.FacilityID
	}

	service := services.NewClassesService(srv.Db)
	items, err := service.GetTodaysSchedule(&args, facilityId)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	args.Total = int64(len(items))
	if !args.All {
		start := args.CalcOffset()
		if start < len(items) {
			end := start + args.PerPage
			if end > len(items) {
				end = len(items)
			}
			items = items[start:end]
		} else {
			items = []models.TodaysScheduleItem{}
		}
	}

	return writePaginatedResponse(w, http.StatusOK, items, args.IntoMeta())
}

func (srv *Server) handleEventOverrides(w http.ResponseWriter, r *http.Request, log sLog) error {
	eventId, err := strconv.Atoi(r.PathValue("event_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "event_id")
	}
	classID, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	cannotCreateOverride, err := srv.cannotUpdateEvent(classID)
	if err != nil {
		return err
	}
	if cannotCreateOverride {
		return newBadRequestServiceError(errors.New("cannot create an event override for a completed or cancelled class"), "cannot create event override")
	}
	var overrides []*models.ProgramClassEventOverride
	if err := json.NewDecoder(r.Body).Decode(&overrides); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	for i, j := 0, len(overrides); i < j; i++ {
		overrides[i].EventID = uint(eventId)
		overrides[i].ClassID = uint(classID)
	}
	var class *models.ProgramClass
	for _, override := range overrides {
		if !override.IsCancelled && override.RoomID != nil {
			var err error
			class, err = srv.Db.GetClassByID(classID)
			if err != nil {
				return newDatabaseServiceError(err)
			}
			break
		}
	}
	for _, override := range overrides {
		if override.IsCancelled || override.RoomID == nil {
			continue
		}
		if _, err := srv.Db.GetRoomByIDForFacility(*override.RoomID, class.FacilityID); err != nil {
			return newDatabaseServiceError(err)
		}
		eventIDUint := uint(eventId)
		conflicts, err := srv.Db.CheckRRuleConflicts(&models.ConflictCheckRequest{
			FacilityID:     class.FacilityID,
			RoomID:         *override.RoomID,
			RecurrenceRule: override.OverrideRrule,
			Duration:       override.Duration,
			ExcludeEventID: &eventIDUint,
		})
		if err != nil {
			return newDatabaseServiceError(err)
		}
		if len(conflicts) > 0 {
			return writeConflictResponse(w, conflicts)
		}
	}
	ctx := srv.getQueryContext(r)
	if err := srv.WithUserContext(r).CreateOverrideEvents(&ctx, overrides); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Override(s) created successfully")
}

type patchEventOverrideRequest struct {
	Date         string `json:"date"`
	StartTime    string `json:"start_time"`
	IsCancelled  bool   `json:"is_cancelled"`
	Reason       string `json:"reason"`
	RoomID       *uint  `json:"room_id"`
	InstructorID *uint  `json:"instructor_id"`
	NewDate      string `json:"new_date"`
	NewStartTime string `json:"new_start_time"`
	NewEndTime   string `json:"new_end_time"`
}

func (srv *Server) handlePatchEventOverride(w http.ResponseWriter, r *http.Request, log sLog) error {
	eventId, err := strconv.Atoi(r.PathValue("event_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "event_id")
	}
	classID, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	cannotCreateOverride, err := srv.cannotUpdateEvent(classID)
	if err != nil {
		return err
	}
	if cannotCreateOverride {
		return newBadRequestServiceError(errors.New("cannot create an event override for a completed or cancelled class"), "cannot create event override")
	}
	var req patchEventOverrideRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	if req.Date == "" {
		return newBadRequestServiceError(errors.New("date is required"), "date is required")
	}
	if req.InstructorID != nil {
		class, err := srv.Db.GetClassByID(classID)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		name, err := srv.Db.GetInstructorNameByID(*req.InstructorID, class.FacilityID)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		if name == "" {
			return newForbiddenServiceError(errors.New("instructor does not belong to this facility"), "instructor not authorized for this facility")
		}
	}
	ctx := srv.getQueryContext(r)
	event, err := srv.Db.GetEventById(eventId)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	eventRule, err := event.GetRRuleWithTimezone(ctx.Timezone)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	// Use GetDTStart() (same as createEventInstances) to get the canonical time.
	// OrigOptions.Dtstart.In(tz) can give a different hour due to DST on the
	// DTSTART date vs the target date. GetDTStart() is what the instance generator uses.
	eventStart := eventRule.GetDTStart()
	canonicalHour := eventStart.Hour()
	canonicalMinute := eventStart.Minute()

	buildRRule := func(dateStr string, optionalTime string) (string, error) {
		dateOnly, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			return "", err
		}
		hour, minute := canonicalHour, canonicalMinute
		if optionalTime != "" {
			parts := strings.Split(optionalTime, ":")
			if len(parts) == 2 {
				hour, _ = strconv.Atoi(parts[0])
				minute, _ = strconv.Atoi(parts[1])
			}
		}
		cleanDate := dateOnly.Format("20060102")
		return fmt.Sprintf("DTSTART;TZID=%s:%sT%02d%02d00\nRRULE:FREQ=DAILY;COUNT=1",
			ctx.Timezone, cleanDate, hour, minute), nil
	}

	originalRRule, err := buildRRule(req.Date, req.StartTime)
	if err != nil {
		return newBadRequestServiceError(err, "invalid date format")
	}

	if req.NewDate != "" {
		newRRule, err := buildRRule(req.NewDate, req.NewStartTime)
		if err != nil {
			return newBadRequestServiceError(err, "invalid new_date format")
		}
		newDuration := event.Duration
		if req.NewStartTime != "" && req.NewEndTime != "" {
			startParts := strings.Split(req.NewStartTime, ":")
			endParts := strings.Split(req.NewEndTime, ":")
			if len(startParts) == 2 && len(endParts) == 2 {
				sh, _ := strconv.Atoi(startParts[0])
				sm, _ := strconv.Atoi(startParts[1])
				eh, _ := strconv.Atoi(endParts[0])
				em, _ := strconv.Atoi(endParts[1])
				dur := time.Duration(eh-sh)*time.Hour + time.Duration(em-sm)*time.Minute
				if dur > 0 {
					newDuration = dur.String()
				}
			}
		}
		newRoomID := event.RoomID
		if req.RoomID != nil {
			newRoomID = req.RoomID
		}
		rescheduleReason := "rescheduled"
		if req.Reason != "" {
			rescheduleReason = req.Reason
		}
		overrides := []*models.ProgramClassEventOverride{
			{
				EventID:       uint(eventId),
				ClassID:       uint(classID),
				Duration:      event.Duration,
				OverrideRrule: originalRRule,
				IsCancelled:   true,
				Reason:        rescheduleReason,
			},
			{
				EventID:       uint(eventId),
				ClassID:       uint(classID),
				Duration:      newDuration,
				OverrideRrule: newRRule,
				IsCancelled:   false,
				RoomID:        newRoomID,
			},
		}
		if err := srv.WithUserContext(r).CreateOverrideEvents(&ctx, overrides); err != nil {
			return newDatabaseServiceError(err)
		}
		return writeJsonResponse(w, http.StatusOK, "Event rescheduled successfully")
	}

	overrideDuration := event.Duration
	overrideRRule := originalRRule
	if req.NewStartTime != "" {
		overrideRRule, err = buildRRule(req.Date, req.NewStartTime)
		if err != nil {
			return newBadRequestServiceError(err, "invalid start time")
		}
		if req.NewEndTime != "" {
			startParts := strings.Split(req.NewStartTime, ":")
			endParts := strings.Split(req.NewEndTime, ":")
			if len(startParts) == 2 && len(endParts) == 2 {
				sh, _ := strconv.Atoi(startParts[0])
				sm, _ := strconv.Atoi(startParts[1])
				eh, _ := strconv.Atoi(endParts[0])
				em, _ := strconv.Atoi(endParts[1])
				dur := time.Duration(eh-sh)*time.Hour + time.Duration(em-sm)*time.Minute
				if dur > 0 {
					overrideDuration = dur.String()
				}
			}
		}
	}
	override := &models.ProgramClassEventOverride{
		EventID:       uint(eventId),
		ClassID:       uint(classID),
		Duration:      overrideDuration,
		OverrideRrule: overrideRRule,
		IsCancelled:   req.IsCancelled,
		Reason:        req.Reason,
		RoomID:        req.RoomID,
		InstructorID:  req.InstructorID,
	}
	if err := srv.WithUserContext(r).CreateOverrideEvents(&ctx, []*models.ProgramClassEventOverride{override}); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Override created successfully")
}

func (srv *Server) handleDeleteEventOverride(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("event_override_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "event override ID")
	}
	classID, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	cannotDelete, err := srv.cannotUpdateEvent(classID)
	if err != nil {
		return err
	}
	if cannotDelete {
		return newBadRequestServiceError(errors.New("cannot delete an event for a completed or cancelled class"), "cannot delete event")
	}
	log.add("class_id", classID)
	log.add("event_override_id", id)
	args := srv.getQueryContext(r)
	undoAppliedFuture := r.URL.Query().Get("undo_applied_future") == "true"
	err = srv.WithUserContext(r).DeleteOverrideEvent(&args, id, classID, undoAppliedFuture)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusNoContent, "Event override(s) deleted successfully")
}

func (srv *Server) handleUncancelSeries(w http.ResponseWriter, r *http.Request, log sLog) error {
	eventID, err := strconv.Atoi(r.PathValue("event_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "event_id")
	}
	var req struct {
		RestoreDate string `json:"restore_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	if req.RestoreDate == "" {
		return newBadRequestServiceError(errors.New("restore date is required"), "restore date is required")
	}
	ctx := srv.getQueryContext(r)
	if err := srv.Db.UncancelEventSeries(&ctx, uint(eventID), req.RestoreDate); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Series uncancelled successfully")
}

func (srv *Server) handleUncancelOverride(w http.ResponseWriter, r *http.Request, log sLog) error {
	overrideID, err := strconv.Atoi(r.PathValue("event_override_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "event override ID")
	}
	ctx := srv.getQueryContext(r)
	if err := srv.Db.UncancelOverride(&ctx, uint(overrideID)); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Override uncancelled successfully")
}

func (srv *Server) handleCreateEvent(w http.ResponseWriter, r *http.Request, log sLog) error {
	classID, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class_id")
	}
	cannotCreate, err := srv.cannotUpdateEvent(classID)
	if err != nil {
		return err
	}
	if cannotCreate {
		return newBadRequestServiceError(errors.New("cannot create new event for a completed or cancelled class"), "cannot create event")
	}
	event := &models.ProgramClassEvent{}
	if err := json.NewDecoder(r.Body).Decode(event); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	event.ClassID = uint(classID)
	if event.RoomID != nil {
		class, err := srv.Db.GetClassByID(classID)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		if _, err := srv.Db.GetRoomByIDForFacility(*event.RoomID, class.FacilityID); err != nil {
			return newDatabaseServiceError(err)
		}
		conflicts, err := srv.Db.CheckRRuleConflicts(&models.ConflictCheckRequest{
			FacilityID:     class.FacilityID,
			RoomID:         *event.RoomID,
			RecurrenceRule: event.RecurrenceRule,
			Duration:       event.Duration,
		})
		if err != nil {
			return newDatabaseServiceError(err)
		}
		if len(conflicts) > 0 {
			return writeConflictResponse(w, conflicts)
		}
	}
	_, err = srv.WithUserContext(r).CreateNewEvent(classID, event)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, "Event created successfully")
}

func (srv *Server) handleRescheduleEventSeries(w http.ResponseWriter, r *http.Request, log sLog) error {
	classID, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class_id")
	}
	cannotUpdate, err := srv.cannotUpdateEvent(classID)
	if err != nil {
		return err
	}
	if cannotUpdate {
		return newBadRequestServiceError(errors.New("cannot reschedule event series for a completed or cancelled class"), "cannot update event")
	}
	var eventSeriesRequest struct {
		EventSeries       models.ProgramClassEvent `json:"event_series"`
		ClosedEventSeries models.ProgramClassEvent `json:"closed_event_series"`
	}
	if err := json.NewDecoder(r.Body).Decode(&eventSeriesRequest); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	if eventSeriesRequest.EventSeries.RoomID != nil {
		class, err := srv.Db.GetClassByID(classID)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		if _, err := srv.Db.GetRoomByIDForFacility(*eventSeriesRequest.EventSeries.RoomID, class.FacilityID); err != nil {
			return newDatabaseServiceError(err)
		}
		var excludeEventID *uint
		if eventSeriesRequest.ClosedEventSeries.ID > 0 {
			closedID := eventSeriesRequest.ClosedEventSeries.ID
			excludeEventID = &closedID
		} else if eventSeriesRequest.EventSeries.ID > 0 {
			excludeEventID = &eventSeriesRequest.EventSeries.ID
		}
		conflicts, err := srv.Db.CheckRRuleConflicts(&models.ConflictCheckRequest{
			FacilityID:     class.FacilityID,
			RoomID:         *eventSeriesRequest.EventSeries.RoomID,
			RecurrenceRule: eventSeriesRequest.EventSeries.RecurrenceRule,
			Duration:       eventSeriesRequest.EventSeries.Duration,
			ExcludeEventID: excludeEventID,
		})
		if err != nil {
			return newDatabaseServiceError(err)
		}
		if len(conflicts) > 0 {
			return writeConflictResponse(w, conflicts)
		}
	}
	args := srv.getQueryContext(r)
	args.All = true
	allEvents, err := srv.Db.GetClassEvents(&args, classID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	eventSeriesRequest.EventSeries.ClassID = uint(classID)
	eventSeriesRequest.ClosedEventSeries.ClassID = uint(classID)
	var events []models.ProgramClassEvent
	if eventSeriesRequest.EventSeries.RecurrenceRule != "" {
		events = append(events, eventSeriesRequest.EventSeries)
	}
	events = append(events, eventSeriesRequest.ClosedEventSeries)
	var maxEvent *models.ProgramClassEvent
	for i := range allEvents {
		if maxEvent == nil || allEvents[i].ID > maxEvent.ID {
			maxEvent = &allEvents[i]
		}
	}
	if maxEvent != nil && maxEvent.ID != eventSeriesRequest.ClosedEventSeries.ID { //making sure of only one active rrule
		untilDate := src.GetUntilDateFromRule(eventSeriesRequest.ClosedEventSeries.RecurrenceRule)
		if untilDate != "" {
			maxEvent.RecurrenceRule = src.ReplaceOrAddUntilDate(maxEvent.RecurrenceRule, untilDate)
			events = append(events, *maxEvent)
		}
	}
	err = srv.WithUserContext(r).CreateRescheduleEventSeries(&args, events)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, "Event rescheduled successfully")
}

func (srv *Server) cannotUpdateEvent(classID int) (bool, error) {
	class, err := srv.Db.GetClassByID(classID)
	if err != nil {
		return false, newDatabaseServiceError(err)
	}
	return class.Status == models.Completed || class.Status == models.Cancelled, nil
}

func (srv *Server) handleGetProgramClassEvents(w http.ResponseWriter, r *http.Request, log sLog) error {
	classID, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class_id")
	}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	var userId *int
	if !claims.isAdmin() {
		tmp := int(claims.UserID)
		userId = &tmp
	} else {
		userIdStr := r.URL.Query().Get("user_id")
		if userIdStr != "" {
			if parsedUserId, err := strconv.Atoi(userIdStr); err == nil {
				userId = &parsedUserId
			} else {
				log.errorf("Error parsing user id: %v", err)
			}
		}
	}

	log.add("class id", classID)
	month := r.URL.Query().Get("month")
	year := r.URL.Query().Get("year")
	justDates := r.URL.Query().Get("dates")
	if justDates == "true" {
		timezone := srv.getQueryContext(r).Timezone
		// Check for optional event_id parameter to get dates for a specific event
		eventIdStr := r.URL.Query().Get("event_id")
		var eventId *int
		if eventIdStr != "" {
			if parsedEventId, err := strconv.Atoi(eventIdStr); err == nil {
				eventId = &parsedEventId
			} else {
				log.errorf("Error parsing event_id: %v", err)
			}
		}
		dates, err := srv.Db.GetClassEventDatesForRecurrence(classID, timezone, month, year, eventId)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		return writeJsonResponse(w, http.StatusOK, dates)
	}

	qryCtx := srv.getQueryContext(r)
	allInstances := r.URL.Query().Get("all") == "true"
	instances, err := srv.Db.GetClassEventInstancesWithAttendanceForRecurrence(classID, &qryCtx, month, year, userId, allInstances)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	return writePaginatedResponse(w, http.StatusOK, instances, qryCtx.IntoMeta())
}
