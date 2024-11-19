package handlers

import (
	"UnlockEdv2/src/models"
	"net/http"
	"strconv"
)

func (srv *Server) registerAttendanceRoutes() []routeDef {
	axx := models.Feature(models.ProviderAccess)
	return []routeDef{
		{"GET /api/program-sections/{id}/attendees", srv.handleGetAttendeesForSection, true, axx},
		{"POST /api/events/{id}/attendees/{user_id}", srv.handleLogAttendeeForEvent, true, axx},
		{"DELETE /api/events/{id}/attendees/{user_id}", srv.handleDeleteAttendee, true, axx},
	}
}

func (srv *Server) handleGetAttendeesForSection(w http.ResponseWriter, r *http.Request, log sLog) error {
	eventID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newBadRequestServiceError(err, "event ID")
	}
	page, perPage := srv.getPaginationInfo(r)
	attendees, err := srv.Db.GetAttendees(page, perPage, r.URL.Query(), eventID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, attendees)
}

func (srv *Server) handleLogAttendeeForEvent(w http.ResponseWriter, r *http.Request, log sLog) error {
	eventID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newBadRequestServiceError(err, "event ID")
	}
	userID, err := strconv.Atoi(r.PathValue("user_id"))
	if err != nil {
		return newBadRequestServiceError(err, "user ID")
	}
	date := r.URL.Query().Get("date")
	attendance, err := srv.Db.LogUserAttendance(eventID, userID, date)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, attendance)
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
