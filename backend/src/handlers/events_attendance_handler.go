package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
	"time"
)

func (srv *Server) registerAttendanceRoutes() []routeDef {
	axx := models.Feature(models.ProgramAccess)
	return []routeDef{
		{"GET /api/program-classes/{class_id}/events/{event_id}/attendance", srv.handleGetEventAttendance, true, axx},
		{"GET /api/program-classes/{class_id}/events/{event_id}/attendance-rate", srv.handleGetAttendanceRateForEvent, true, axx},
		{"POST /api/program-classes/{class_id}/events/{event_id}/attendance", srv.handleAddAttendanceForEvent, true, axx},
		{"DELETE /api/program-classes/{class_id}/events/{event_id}/attendance/{user_id}", srv.handleDeleteAttendee, true, axx},
	}
}

func (srv *Server) handleAddAttendanceForEvent(w http.ResponseWriter, r *http.Request, log sLog) error {
	classId, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	class, err := srv.Db.GetClassByID(classId)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if err := class.CanUpdateClass(); err != nil {
		return writeJsonResponse(w, http.StatusBadRequest, err.Error())
	}
	eventID, err := strconv.Atoi(r.PathValue("event_id"))
	if err != nil {
		return newBadRequestServiceError(err, "event ID")
	}
	var attendances []models.ProgramClassEventAttendance
	err = json.NewDecoder(r.Body).Decode(&attendances)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	const isoLayout = "2006-01-02"
	today := time.Now().In(time.Local).Truncate(24 * time.Hour)
	for i := range attendances {
		if attendances[i].Date == "" {
			attendances[i].Date = time.Now().Format("2006-01-02")
		}

		parsed, err := time.ParseInLocation(isoLayout, attendances[i].Date, time.Local)
		if err != nil {
			return newBadRequestServiceError(err, "unable to parse time")
		}

		if parsed.After(today) {
			return writeJsonResponse(w, http.StatusUnprocessableEntity, "attempted attendance date in future")
		}
		attendances[i].EventID = uint(eventID)
	}
	if err := srv.Db.LogUserAttendance(&attendances); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Attendance updated")
}

func (srv *Server) handleDeleteAttendee(w http.ResponseWriter, r *http.Request, log sLog) error {
	eventID, err := strconv.Atoi(r.PathValue("event_id"))
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
	return writeJsonResponse(w, http.StatusNoContent, any(nil))
}

func (srv *Server) handleGetEventAttendance(w http.ResponseWriter, r *http.Request, log sLog) error {
	classID, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newBadRequestServiceError(err, "class_id")
	}
	log.add("class id", classID)
	eventID, err := strconv.Atoi(r.PathValue("event_id"))
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

func (srv *Server) handleGetAttendanceRateForEvent(w http.ResponseWriter, r *http.Request, log sLog) error {
	eventID, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	classID, err := strconv.Atoi(r.PathValue("event_id"))
	if err != nil {
		return newInvalidQueryParamServiceError(err, "event ID")
	}
	attendanceRate, err := srv.Db.GetAttendanceRateForEvent(r.Context(), eventID, classID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	response := map[string]float64{
		"attendance_rate": attendanceRate,
	}
	return writeJsonResponse(w, http.StatusOK, response)
}
