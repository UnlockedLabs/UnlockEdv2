package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/teambition/rrule-go"
)

func (srv *Server) registerAttendanceRoutes() []routeDef {
	axx := models.ProgramAccess
	resolver := FacilityAdminResolver("program_classes", "class_id")
	return []routeDef{
		adminValidatedFeatureRoute("GET /api/program-classes/{class_id}/events/{event_id}/attendance", srv.handleGetEventAttendance, axx, resolver),
		adminValidatedFeatureRoute("GET /api/program-classes/{class_id}/events/{event_id}/attendance-rate", srv.handleGetAttendanceRateForEvent, axx, resolver),
		adminValidatedFeatureRoute("POST /api/program-classes/{class_id}/events/{event_id}/attendance", srv.handleAddAttendanceForEvent, axx, resolver),
		adminValidatedFeatureRoute("DELETE /api/program-classes/{class_id}/events/{event_id}/attendance/{user_id}", srv.handleDeleteAttendee, axx, resolver),
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
	if class.CannotUpdateClass() {
		return newBadRequestServiceError(err, "cannot perform action on class that is completed cancelled or archived")
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
	if err := srv.Db.LogUserAttendance(attendances); err != nil {
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

	overrides, err := srv.Db.GetOverrideEvents(&args, eventID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if isDateCancelled(overrides, date) { //check overrides for cancelled date
		return writePaginatedResponse(w, http.StatusConflict, []models.EnrollmentAttendance{}, args.IntoMeta())
	}

	combined, err := srv.Db.GetEnrollmentsWithAttendanceForEvent(&args, classID, eventID, date)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, combined, args.IntoMeta())
}

func isDateCancelled(overrides []models.ProgramClassEventOverride, eventDate string) bool {
	formatPattern := "2006-01-02"
	evtDate, err := time.Parse(formatPattern, eventDate) ///making sure the date is good
	if err != nil {
		return false
	}

	var isRescheduled bool
	for _, override := range overrides {
		rRule, err := rrule.StrToRRule(override.OverrideRrule)
		if err != nil {
			continue
		}
		if len(rRule.All()) == 0 {
			continue
		}
		overrideDate := rRule.All()[0].Format(formatPattern)

		if overrideDate == evtDate.Format(formatPattern) {
			if override.IsCancelled {
				if override.Reason == "rescheduled" {
					isRescheduled = true
					break
				}
				return true // a true cancellation
			}
		}
	}

	if isRescheduled { //check for reschedules on same date
		for _, override := range overrides {
			rRule, err := rrule.StrToRRule(override.OverrideRrule)
			if err != nil {
				continue
			}
			if len(rRule.All()) == 0 {
				continue
			}
			overrideDate := rRule.All()[0].Format(formatPattern)
			if overrideDate == evtDate.Format(formatPattern) && !override.IsCancelled { //is it rescheduled on the same date??
				return false
			}
		}
		return true
	}
	return false
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
