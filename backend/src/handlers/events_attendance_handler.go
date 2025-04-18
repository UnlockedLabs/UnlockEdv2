package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
	"time"
)

func (srv *Server) registerAttendanceRoutes() []routeDef {
	axx := models.Feature(models.ProviderAccess)
	return []routeDef{
		{"GET /api/program-classes/{id}/attendees", srv.handleGetAttendeesForClass, true, axx},
		{"GET /api/program-classes/{class_id}/event-attendance", srv.handleGetEventAttendance, true, axx},
		{"POST /api/events/{id}/attendances", srv.handleAddAttendanceForEvent, true, axx},
		{"DELETE /api/events/{id}/attendees/{user_id}", srv.handleDeleteAttendee, true, axx},
	}
}

func (srv *Server) handleGetAttendeesForClass(w http.ResponseWriter, r *http.Request, log sLog) error {
	eventID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newBadRequestServiceError(err, "event ID")
	}
	queryParams := srv.getQueryContext(r)
	attendees, err := srv.Db.GetAttendees(&queryParams, r.URL.Query(), eventID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, attendees)
}

func (srv *Server) handleAddAttendanceForEvent(w http.ResponseWriter, r *http.Request, log sLog) error {
	var attendances []models.ProgramClassEventAttendance
	err := json.NewDecoder(r.Body).Decode(&attendances)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	for _, att := range attendances {
		if att.Date == "" {
			att.Date = time.Now().Format("2006-01-02")
		}
	}
	if err := srv.Db.LogUserAttendance(&attendances); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Attendance updated")
}

func (srv *Server) handleDeleteAttendee(w http.ResponseWriter, r *http.Request, log sLog) error {
	eventID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newBadRequestServiceError(err, "event ID")
	}
	userID, err := strconv.Atoi(r.PathValue("user_id"))
	if err != nil {
		return newBadRequestServiceError(err, "user ID")
	}
	err = srv.Db.DeleteAttendance(eventID, userID, r.URL.Query().Get("date"))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusNoContent, "success")
}
func (srv *Server) handleGetEventAttendance(w http.ResponseWriter, r *http.Request, log sLog) error {
	classID, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newBadRequestServiceError(err, "class_id")
	}
	log.add("class id", classID)
	eventID, err := strconv.Atoi(r.URL.Query().Get("event_id"))
	if err != nil {
		return newBadRequestServiceError(err, "event_id")
	}
	log.add("event id", eventID)
	date := r.URL.Query().Get("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}
	log.add("date", date)

	args := srv.getQueryContext(r)
	combined, err := srv.Db.GetEnrollmentsWithAttendanceForEvent(&args, classID, eventID, date)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, combined, args.IntoMeta())
}
