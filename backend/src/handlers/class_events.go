package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerClassEventsRoutes() []routeDef {
	axx := []models.FeatureAccess{models.ProgramAccess}
	return []routeDef{
		{"GET /api/admin-calendar", srv.handleGetAdminCalendar, true, axx},
		{"GET /api/program-classes/{class_id}/events", srv.handleGetProgramClassEvents, true, axx},
		{"GET /api/student-calendar", srv.handleGetStudentCalendar, false, axx},
		{"GET /api/student-attendance", srv.handleGetStudentAttendanceData, false, axx},
		{"PUT /api/events/{event_id}", srv.handleEventOverride, true, axx},
		{"POST /api/program-classes/{id}/events", srv.handleCreateEvent, true, axx},
	}
}

func (srv *Server) handleGetAdminCalendar(w http.ResponseWriter, r *http.Request, log sLog) error {
	dtRng, err := getDateRange(r)
	if err != nil {
		return newInvalidQueryParamServiceError(err, "start_dt")
	}
	args := srv.getQueryContext(r)
	events, err := srv.Db.GetFacilityCalendar(&args, dtRng)
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

func (srv *Server) handleEventOverride(w http.ResponseWriter, r *http.Request, log sLog) error {
	eventId, err := strconv.Atoi(r.PathValue("event_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "event_id")
	}
	override := &models.ProgramClassEventOverride{}
	if err := json.NewDecoder(r.Body).Decode(override); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	override.EventID = uint(eventId)
	ctx := srv.getQueryContext(r)
	if err := srv.Db.CreateOverrideEvent(&ctx, override); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Override created successfully")
}

func (srv *Server) handleCreateEvent(w http.ResponseWriter, r *http.Request, log sLog) error {
	classID, err := strconv.Atoi(r.PathValue("id"))
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
	instances, err := srv.Db.GetClassEventInstancesWithAttendanceForRecurrence(classID, &qryCtx, month, year)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	return writePaginatedResponse(w, http.StatusOK, instances, qryCtx.IntoMeta())
}
