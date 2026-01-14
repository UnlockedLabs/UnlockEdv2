package handlers

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
)

func (srv *Server) registerClassEventsRoutes() []routeDef {
	axx := models.ProgramAccess
	resolver := FacilityAdminResolver("program_classes", "class_id")
	return []routeDef{
		featureRoute("GET /api/student-calendar", srv.handleGetStudentCalendar, axx),
		featureRoute("GET /api/program-classes/{class_id}/events", srv.handleGetProgramClassEvents, axx),
		/* admin */
		adminFeatureRoute("GET /api/admin-calendar", srv.handleGetAdminCalendar, axx),
		adminValidatedFeatureRoute("PUT /api/program-classes/{class_id}/events/{event_id}", srv.handleEventOverrides, axx, resolver),
		adminValidatedFeatureRoute("DELETE /api/program-classes/{class_id}/events/{event_override_id}", srv.handleDeleteEventOverride, axx, resolver),
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
	err = srv.WithUserContext(r).DeleteOverrideEvent(&args, id, classID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusNoContent, "Event override(s) deleted successfully")
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
		if eventSeriesRequest.EventSeries.ID > 0 {
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
	events := []models.ProgramClassEvent{
		eventSeriesRequest.EventSeries,
		eventSeriesRequest.ClosedEventSeries,
	}
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
	instances, err := srv.Db.GetClassEventInstancesWithAttendanceForRecurrence(classID, &qryCtx, month, year, userId)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	return writePaginatedResponse(w, http.StatusOK, instances, qryCtx.IntoMeta())
}
