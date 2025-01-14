package handlers

import (
	"UnlockEdv2/src/models"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func (srv *Server) registerActivityRoutes() []routeDef {
	axx := models.Feature(models.ProviderAccess)
	return []routeDef{
		{"GET /api/users/{id}/daily-activity", srv.handleGetDailyActivityByUserID, false, axx},
		{"GET /api/courses/{id}/activity", srv.handleGetCourseActivity, true, axx},
	}
}

/****
 * @Query Params:
 * ?start_date
 * ?end_date
 ****/
func (srv *Server) handleGetDailyActivityByUserID(w http.ResponseWriter, r *http.Request, log sLog) error {
	userID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	if !srv.canViewUserData(r, userID) {
		log.add("requesting_user", srv.getUserID(r))
		log.error("non admin requesting to view other student activities")
		return newForbiddenServiceError(errors.New("non admin requesting to view other student activities"), "You do not have permission to view this user's activities")
	}
	startDate, err := time.Parse("2006-01-02", strings.Split(r.URL.Query().Get("start_date"), "T")[0])
	if err != nil {
		return newInvalidQueryParamServiceError(err, "start_date")
	}
	endDate, err := time.Parse("2006-01-02", strings.Split(r.URL.Query().Get("end_date"), "T")[0])
	if err != nil {
		return newInvalidQueryParamServiceError(err, "end_date")
	}
	activities, err := srv.Db.GetDailyActivityByUserID(userID, startDate, endDate)
	if err != nil {
		log.error("error getting daily activity by user ID")
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, map[string]interface{}{
		"activities": activities,
	})
}

func (srv *Server) handleGetCourseActivity(w http.ResponseWriter, r *http.Request, log sLog) error {
	courseID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "course ID")
	}
	log.add("course_id", courseID)
	page, perPage := srv.getPaginationInfo(r)
	count, activities, err := srv.Db.GetActivityByCourseID(page, perPage, courseID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, map[string]interface{}{
		"count":      count,
		"activities": activities,
	})
}
