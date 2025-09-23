package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/teambition/rrule-go"
)

func (srv *Server) registerAttendanceRoutes() []routeDef {
	axx := models.ProgramAccess
	resolver := FacilityAdminResolver("program_classes", "class_id")
	return []routeDef{
		adminValidatedFeatureRoute("GET /api/program-classes/{class_id}/events/{event_id}/attendance", srv.handleGetEventAttendance, axx, resolver),
		adminValidatedFeatureRoute("GET /api/program-classes/{class_id}/events/{event_id}/attendance-rate", srv.handleGetAttendanceRateForEvent, axx, resolver),
		adminValidatedFeatureRoute("GET /api/program-classes/{class_id}/historical-enrollment-batch", srv.handleGetHistoricalEnrollmentBatch, axx, resolver),
		adminValidatedFeatureRoute("POST /api/program-classes/{class_id}/events/{event_id}/attendance", srv.handleAddAttendanceForEvent, axx, resolver),
		adminValidatedFeatureRoute("DELETE /api/program-classes/{class_id}/events/{event_id}/attendance/{user_id}", srv.handleDeleteAttendee, axx, resolver),
	}
}

// O(N+1) query problem in this method, but it is not a performance critical endpoint
// and the number of enrollments is usually small, so for now we're going to live with it.
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
	now := time.Now().In(time.Local)
	endOfToday := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, time.Local)

	args := srv.getQueryContext(r)
	overrides, err := srv.Db.GetProgramClassEventOverrides(&args, []uint{uint(eventID)}...)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	uniqueUserIDs := make(map[uint]struct{})
	for i := range attendances {
		if attendances[i].UserID != 0 {
			uniqueUserIDs[attendances[i].UserID] = struct{}{}
		}
	}

	userIDSlice := make([]uint, 0, len(uniqueUserIDs))
	for uid := range uniqueUserIDs {
		userIDSlice = append(userIDSlice, uid)
	}

	enrolledIDs, err := srv.Db.GetEnrolledUserIDsForClass(uint(classId), userIDSlice)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	enrolledSet := make(map[uint]struct{}, len(enrolledIDs))
	for _, uid := range enrolledIDs {
		enrolledSet[uid] = struct{}{}
	}
	for i := range attendances {
		if attendances[i].Date == "" {
			attendances[i].Date = time.Now().Format("2006-01-02")
		}

		parsed, err := time.ParseInLocation(isoLayout, attendances[i].Date, time.Local)
		if err != nil {
			return newBadRequestServiceError(err, "unable to parse time")
		}

		if parsed.After(endOfToday) {
			return writeJsonResponse(w, http.StatusUnprocessableEntity, "attempted attendance date in future")
		}
		if isDateCancelled(overrides, attendances[i].Date) {
			return writeJsonResponse(w, http.StatusConflict, "cannot record attendance for cancelled class date")
		}

		if _, ok := enrolledSet[attendances[i].UserID]; !ok {
			return writeJsonResponse(w, http.StatusBadRequest,
				fmt.Sprintf("user %d is not enrolled in class %d", attendances[i].UserID, classId))
		}
		attendances[i].EventID = uint(eventID)
	}
	if err := srv.Db.LogUserAttendance(attendances, r.Context(), &args.UserID, class.Name); err != nil {
		return newDatabaseServiceError(err)
	}

	return writeJsonResponse(w, http.StatusOK, "Attendance updated")
}

func (srv *Server) handleDeleteAttendee(w http.ResponseWriter, r *http.Request, log sLog) error {
	classID, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newBadRequestServiceError(err, "class ID")
	}
	class, err := srv.Db.GetClassByID(classID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	eventID, err := strconv.Atoi(r.PathValue("event_id"))
	if err != nil {
		return newBadRequestServiceError(err, "event ID")
	}
	userID, err := strconv.Atoi(r.PathValue("user_id"))
	if err != nil {
		return newBadRequestServiceError(err, "user ID")
	}
	date := r.URL.Query().Get("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	args := srv.getQueryContext(r)
	overrides, err := srv.Db.GetProgramClassEventOverrides(&args, []uint{uint(eventID)}...)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if isDateCancelled(overrides, date) {
		return writeJsonResponse(w, http.StatusConflict, "cannot delete attendance for cancelled class date")
	}

	var enrollment models.ProgramClassEnrollment
	enrollmentErr := srv.Db.Where("class_id = ? AND user_id = ? AND enrollment_status = ?",
		classID, userID, models.Enrolled).First(&enrollment).Error
	if enrollmentErr != nil {
		return writeJsonResponse(w, http.StatusBadRequest, "user is not enrolled in class")
	}

	rowsAffected, err := srv.Db.DeleteAttendance(eventID, userID, date, r.Context(), &args.UserID, class.Name)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	if rowsAffected == 0 {
		return writeJsonResponse(w, http.StatusBadRequest, "user is not enrolled in class or has no attendance record for this date")
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

	class, err := srv.Db.GetClassByID(classID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	includeCurrentlyEnrolled := class.Status != models.Active

	overrides, err := srv.Db.GetProgramClassEventOverrides(&args, []uint{uint(eventID)}...)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if isDateCancelled(overrides, date) { //check overrides for cancelled date
		return writePaginatedResponse(w, http.StatusConflict, []models.EnrollmentAttendance{}, args.IntoMeta())
	}

	combined, err := srv.Db.GetEnrollmentsWithAttendanceForEvent(&args, classID, eventID, date, includeCurrentlyEnrolled)
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
	date := r.URL.Query().Get("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}
	attendanceRate, err := srv.Db.GetAttendanceRateForEvent(r.Context(), eventID, classID, date)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	response := map[string]float64{
		"attendance_rate": attendanceRate,
	}
	return writeJsonResponse(w, http.StatusOK, response)
}

func (srv *Server) handleGetHistoricalEnrollmentBatch(w http.ResponseWriter, r *http.Request, log sLog) error {
	classID, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}

	datesParam := r.URL.Query().Get("dates")
	if datesParam == "" {
		return newBadRequestServiceError(nil, "dates parameter is required")
	}

	dates := strings.Split(datesParam, ",")
	if len(dates) == 0 {
		return newBadRequestServiceError(nil, "at least one date must be provided")
	}

	for _, date := range dates {
		if _, err := time.Parse("2006-01-02", strings.TrimSpace(date)); err != nil {
			return newBadRequestServiceError(err, "invalid date format: "+date)
		}
	}

	results, err := srv.Db.GetHistoricalEnrollmentForDates(classID, dates)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	return writeJsonResponse(w, http.StatusOK, results)
}
