package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

func (srv *Server) registerClassEventsRoutes() []routeDef {
	axx := models.ProgramAccess
	resolver := FacilityAdminResolver("program_classes", "class_id")
	return []routeDef{
		featureRoute("GET /api/student-calendar", srv.handleGetStudentCalendar, axx),
		featureRoute("GET /api/student-attendance", srv.handleGetStudentAttendanceData, axx),
		/* admin */
		adminFeatureRoute("GET /api/admin-calendar", srv.handleGetAdminCalendar, axx),
		adminValidatedFeatureRoute("GET /api/program-classes/{class_id}/events", srv.handleGetProgramClassEvents, axx, resolver),
		adminValidatedFeatureRoute("PUT /api/program-classes/{class_id}/events/{event_id}", srv.handleEventOverrides, axx, resolver),
		adminValidatedFeatureRoute("POST /api/program-classes/{class_id}/events", srv.handleCreateEvent, axx, resolver),
		adminValidatedFeatureRoute("PUT /api/program-classes/{class_id}/events", srv.handleRescheduleEventSeries, axx, resolver),
	}
}

func (srv *Server) handleGetAdminCalendar(w http.ResponseWriter, r *http.Request, log sLog) error {
	dtRng, err := getDateRange(r)
	if err != nil {
		return newInvalidQueryParamServiceError(err, "start_dt")
	}
	id := r.URL.Query().Get("class_id")
	var classID int
	if id != "" {
		classID, err = strconv.Atoi(id)
		if err != nil {
			return newInvalidIdServiceError(err, "class_id")
		}
	}
	args := srv.getQueryContext(r)
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
	claims := r.Context().Value(ClaimsKey).(*Claims)
	calendar, err := srv.Db.GetCalendar(dtRng, &claims.UserID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, calendar)
}

func (srv *Server) handleEventOverrides(w http.ResponseWriter, r *http.Request, log sLog) error {
	eventId, err := strconv.Atoi(r.PathValue("event_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "event_id")
	}
	var overrides []*models.ProgramClassEventOverride
	if err := json.NewDecoder(r.Body).Decode(&overrides); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	for i, j := 0, len(overrides); i < j; i++ {
		overrides[i].EventID = uint(eventId)
	}
	ctx := srv.getQueryContext(r)
	if err := srv.Db.CreateOverrideEvents(&ctx, overrides); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Override(s) created successfully")
}

func (srv *Server) handleCreateEvent(w http.ResponseWriter, r *http.Request, log sLog) error {
	classID, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class_id")
	}
	event := &models.ProgramClassEvent{}
	if err := json.NewDecoder(r.Body).Decode(event); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	_, err = srv.Db.CreateNewEvent(classID, event)
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
	var eventSeriesRequest struct {
		EventSeries       models.ProgramClassEvent `json:"event_series"`
		ClosedEventSeries models.ProgramClassEvent `json:"closed_event_series"`
	}
	if err := json.NewDecoder(r.Body).Decode(&eventSeriesRequest); err != nil {
		return newJSONReqBodyServiceError(err)
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
		untilDate := getUntilDateFromRule(eventSeriesRequest.ClosedEventSeries.RecurrenceRule)
		if untilDate != "" {
			maxEvent.RecurrenceRule = replaceOrAddUntilDate(maxEvent.RecurrenceRule, untilDate)
			events = append(events, *maxEvent)
		}
	}
	err = srv.Db.CreateRescheduleEventSeries(&args, events)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, "Event rescheduled successfully")
}

func (srv *Server) handleGetStudentAttendanceData(w http.ResponseWriter, r *http.Request, log sLog) error {
	userId := r.Context().Value(ClaimsKey).(*Claims).UserID
	programData, err := srv.Db.GetStudentProgramAttendanceData(userId)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, programData)
}

func (srv *Server) handleGetProgramClassEvents(w http.ResponseWriter, r *http.Request, log sLog) error {
	classID, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class_id")
	}

	var userId *int
	userIdStr := r.URL.Query().Get("user_id")
	if userIdStr != "" {
		if parsedUserId, err := strconv.Atoi(userIdStr); err == nil {
			userId = &parsedUserId
		} else {
			log.errorf("Error parsing user id: %v", err)
		}
	}

	log.add("class id", classID)
	month := r.URL.Query().Get("month")
	year := r.URL.Query().Get("year")
	justDates := r.URL.Query().Get("dates")
	if justDates == "true" {
		timezone := srv.getQueryContext(r).Timezone
		dates, err := srv.Db.GetClassEventDatesForRecurrence(classID, timezone, month, year)
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

func getUntilDateFromRule(rRule string) string {
	for _, rRulePart := range strings.Split(rRule, ";") {
		if strings.HasPrefix(rRulePart, "UNTIL=") {
			return strings.TrimPrefix(rRulePart, "UNTIL=")
		}
	}
	return ""
}

func replaceOrAddUntilDate(rRule, untilDate string) string {
	rRuleParts := strings.Split(rRule, ";")
	untilExists := false
	for i, part := range rRuleParts {
		if strings.HasPrefix(part, "UNTIL=") {
			rRuleParts[i] = "UNTIL=" + untilDate
			untilExists = true
			break
		}
	}
	if !untilExists {
		rRuleParts = append(rRuleParts, "UNTIL="+untilDate)
	}
	return strings.Join(rRuleParts, ";")
}
