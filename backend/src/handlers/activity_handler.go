package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

func (srv *Server) registerActivityRoutes() {
	srv.Mux.Handle("GET /api/users/{id}/activity", srv.applyMiddleware(srv.HandleError(srv.HandleGetActivityByUserID)))
	srv.Mux.Handle("GET /api/users/{id}/daily-activity", srv.applyMiddleware(srv.HandleError(srv.HandleGetDailyActivityByUserID)))
	srv.Mux.Handle("GET /api/courses/{id}/activity", srv.ApplyAdminMiddleware(srv.HandleError(srv.HandleGetCourseActivity)))
	srv.Mux.Handle("POST /api/users/{id}/activity", srv.ApplyAdminMiddleware(srv.HandleError(srv.HandleCreateActivity)))
}

func (srv *Server) HandleGetActivityByUserID(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleGetActivityByUserID")
	year := r.URL.Query().Get("year")
	if year == "" {
		year = fmt.Sprintf("%d", time.Now().Year())
	}
	yearInt, err := strconv.Atoi(year)
	if err != nil {
		return newInvalidQueryParamServiceError(err, "year")
	}
	userID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	activities, err := srv.Db.GetActivityByUserID(uint(userID), yearInt)
	if err != nil {
		fields.add("year", yearInt)
		fields.add("userId", userID)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, map[string]interface{}{
		"activities": activities,
	})
}

/****
 * @Query Params:
 * ?year=: year (default last year)
 ****/
func (srv *Server) HandleGetDailyActivityByUserID(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleGetDailyActivityByUserID")
	userID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	fields.add("userId", userID)
	requestingUser := int(srv.GetUserID(r))
	if requestingUser != userID && !srv.UserIsAdmin(r) {
		fields.add("requestingUser", requestingUser)
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
		fields.add("year", yearStr)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, map[string]interface{}{
		"activities": activities,
	})
}

func (srv *Server) HandleGetCourseActivity(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	courseID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "course ID")
	}
	page, perPage := srv.GetPaginationInfo(r)
	count, activities, err := srv.Db.GetActivityByCourseID(page, perPage, courseID)
	if err != nil {
		fields.add("course_id", courseID)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, map[string]interface{}{
		"count":      count,
		"activities": activities,
	})
}

func (srv *Server) HandleCreateActivity(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleCreateActivity")
	activity := &models.Activity{}
	if err := json.NewDecoder(r.Body).Decode(activity); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	if err := srv.Db.CreateActivity(activity); err != nil {
		fields.add("activity.UserID", activity.UserID)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, activity)
}
