package handlers

import (
	"UnlockEdv2/src/models"
	"errors"
	"net/http"
	"strconv"
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
 * ?year=: year (default last year)
 ****/
func (srv *Server) handleGetDailyActivityByUserID(w http.ResponseWriter, r *http.Request, log sLog) error {
	userID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	if !srv.canViewUserData(r, userID) {
		user := r.Context().Value(ClaimsKey).(*Claims)
		log.add("requesting_user", user.UserID)
		log.error("non admin requesting to view other student activities")
		return newForbiddenServiceError(errors.New("non admin requesting to view other student activities"), "You do not have permission to view this user's activities")
	}
	yearStr := r.URL.Query().Get("year")
	var year int
	if yearStr != "" {
		year, err = strconv.Atoi(yearStr)
		if err != nil {
			return newInvalidQueryParamServiceError(err, "year")
		}
	}
	activities, err := srv.Db.GetDailyActivityByUserID(userID, year)
	if err != nil {
		log.add("year", yearStr)
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
