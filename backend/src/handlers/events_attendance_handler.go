package handlers

import (
	"net/http"
	"strconv"
)

func (srv *Server) registerAttendanceRoutes() {
	srv.Mux.Handle("GET /api/program-sections/{id}/attendees", srv.applyAdminMiddleware(srv.handleGetAttendeesForSection))
	srv.Mux.Handle("POST /api/events/{id}/attendees/{user_id}", srv.applyAdminMiddleware(srv.handleLogAttendeeForEvent))
	srv.Mux.Handle("DELETE /api/events/{id}/attendees/{user_id}", srv.applyAdminMiddleware(srv.handleDeleteAttendee))
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
	return writeJsonResponse(w, http.StatusOK, "success")
}
