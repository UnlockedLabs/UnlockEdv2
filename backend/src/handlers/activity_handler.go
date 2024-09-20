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
	srv.Mux.Handle("GET /api/users/{id}/activity", srv.applyMiddleware(srv.handleError(srv.handleGetActivityByUserID))) //putting this one on hold...query broken
	srv.Mux.Handle("GET /api/users/{id}/daily-activity", srv.applyMiddleware(srv.handleError(srv.handleGetDailyActivityByUserID)))
	srv.Mux.Handle("GET /api/programs/{id}/activity", srv.applyAdminMiddleware(srv.handleError(srv.handleGetProgramActivity)))
	srv.Mux.Handle("POST /api/users/{id}/activity", srv.applyAdminMiddleware(srv.handleError(srv.handleCreateActivity))) //putting this one on hold...query function
}

func (srv *Server) handleGetActivityByUserID(w http.ResponseWriter, r *http.Request, log sLog) error {
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
		log.add("year", yearInt)
		log.add("userId", userID)
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
func (srv *Server) handleGetDailyActivityByUserID(w http.ResponseWriter, r *http.Request, log sLog) error {
	userID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	log.add("userId", userID)
	requestingUser := int(srv.userIdFromRequest(r))
	if requestingUser != userID && !srv.UserIsAdmin(r) {
		log.add("requestingUser", requestingUser)
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

func (srv *Server) handleGetProgramActivity(w http.ResponseWriter, r *http.Request, log sLog) error {
	programID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	page, perPage := srv.getPaginationInfo(r)
	count, activities, err := srv.Db.GetActivityByProgramID(page, perPage, programID)
	if err != nil {
		log.add("programID", programID)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, map[string]interface{}{
		"count":      count,
		"activities": activities,
	})
}

func (srv *Server) handleCreateActivity(w http.ResponseWriter, r *http.Request, log sLog) error {
	activity := &models.Activity{}
	if err := json.NewDecoder(r.Body).Decode(activity); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	if err := srv.Db.CreateActivity(activity); err != nil {
		log.add("activity.UserID", activity.UserID)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, activity)
}
