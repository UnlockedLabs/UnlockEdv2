package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"
)

func (srv *Server) registerSectionEventsRoutes() {
	srv.Mux.Handle("GET /api/admin-calendar", srv.applyAdminMiddleware(srv.handleGetAdminCalendar))
	srv.Mux.Handle("GET /api/student-calendar", srv.applyMiddleware(srv.handleGetStudentCalendar))
	srv.Mux.Handle("PUT /api/events/{event_id}", srv.applyAdminMiddleware(srv.handleEventOverride))
	// srv.Mux.Handle("DELETE /api/events/{event_id}", srv.applyAdminMiddlware(srv.handleDeleteEvent))
}

func (srv *Server) handleGetAdminCalendar(w http.ResponseWriter, r *http.Request, log sLog) error {
	month, year, err := getMonthAndYear(r)
	if err != nil {
		return newBadRequestServiceError(err, "year query parameter")
	}
	facilityId := r.Context().Value(ClaimsKey).(*Claims).FacilityID
	calendar, err := srv.Db.GetCalendar(month, year, facilityId, nil)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, calendar)
}

func getMonthAndYear(r *http.Request) (time.Month, int, error) {
	month := r.URL.Query().Get("month")
	year := r.URL.Query().Get("year")
	curr := time.Now()
	if month == "" {
		month = curr.Format("01")
	}
	if year == "" {
		year = curr.Format("2006")
	}
	intYr, err := strconv.Atoi(year)
	if err != nil {
		return time.Now().Month(), 0, errors.New("year query parameter must be an integer")
	}
	monthInt, err := strconv.Atoi(month)
	if err != nil {
		return time.Now().Month(), 0, errors.New("month query parameter must be an integer")
	}
	return time.Month(monthInt), intYr, nil
}

func (srv *Server) handleGetStudentCalendar(w http.ResponseWriter, r *http.Request, log sLog) error {
	month, year, err := getMonthAndYear(r)
	if err != nil {
		return newBadRequestServiceError(err, "year query parameter")
	}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	calendar, err := srv.Db.GetCalendar(month, year, claims.FacilityID, &claims.UserID)
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
	override := &models.OverrideForm{}
	if err := json.NewDecoder(r.Body).Decode(override); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	_, err = srv.Db.NewEventOverride(eventId, override)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	// should this return the new calendar to populate?
	return writeJsonResponse(w, http.StatusOK, "Override created successfully")
}
