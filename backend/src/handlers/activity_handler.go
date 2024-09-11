package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerActivityRoutes() {
	srv.Mux.Handle("GET /api/users/{id}/activity", srv.applyMiddleware(srv.HandleError(srv.HandleGetActivityByUserID)))
	srv.Mux.Handle("GET /api/users/{id}/daily-activity", srv.applyMiddleware(srv.HandleError(srv.HandleGetDailyActivityByUserID)))
	srv.Mux.Handle("GET /api/programs/{id}/activity", srv.ApplyAdminMiddleware(srv.HandleError(srv.HandleGetProgramActivity)))
	srv.Mux.Handle("POST /api/users/{id}/activity", srv.ApplyAdminMiddleware(srv.HandleError(srv.HandleCreateActivity)))
}

func (srv *Server) HandleGetActivityByUserID(w http.ResponseWriter, r *http.Request) error {
	year := r.URL.Query().Get("year")
	if year == "" {
		year = fmt.Sprintf("%d", time.Now().Year())
	}
	yearInt, err := strconv.Atoi(year)
	if err != nil {
		return newInvalidQueryParamServiceError(err, "year", nil)
	}
	userID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID", nil)
	}
	activities, err := srv.Db.GetActivityByUserID(uint(userID), yearInt)
	if err != nil {
		return newDatabaseServiceError(err, nil)
	}
	return writeJsonResponse(w, http.StatusOK, map[string]interface{}{
		"activities": activities,
	})
}

/****
 * @Query Params:
 * ?year=: year (default last year)
 ****/
func (srv *Server) HandleGetDailyActivityByUserID(w http.ResponseWriter, r *http.Request) error {
	fields := log.Fields{"handler": "HandleGetDailyActivityByUserID"}
	userID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID", fields)
	}
	fields["user_id"] = userID
	requestingUser := int(srv.GetUserID(r))
	if requestingUser != userID && !srv.UserIsAdmin(r) {
		return newForbiddenServiceError(errors.New("non admin requesting to view other student activities"), "You do not have permission to view this user's activities", fields)
	}
	yearStr := r.URL.Query().Get("year")
	var year int
	if yearStr != "" {
		year, err = strconv.Atoi(yearStr)
		if err != nil {
			fields["error"] = err.Error()
			return newInvalidQueryParamServiceError(err, "year", fields)
		}
	}
	activities, err := srv.Db.GetDailyActivityByUserID(userID, year)
	if err != nil {
		fields["error"] = err.Error()
		return newDatabaseServiceError(err, fields)
	}
	return writeJsonResponse(w, http.StatusOK, map[string]interface{}{
		"activities": activities,
	})
}

func (srv *Server) HandleGetProgramActivity(w http.ResponseWriter, r *http.Request) error {
	programID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID", nil)
	}
	page, perPage := srv.GetPaginationInfo(r)
	count, activities, err := srv.Db.GetActivityByProgramID(page, perPage, programID)
	if err != nil {
		return newDatabaseServiceError(err, nil)
	}
	return writeJsonResponse(w, http.StatusOK, map[string]interface{}{
		"count":      count,
		"activities": activities,
	})
}

func (srv *Server) HandleCreateActivity(w http.ResponseWriter, r *http.Request) error {
	activity := &models.Activity{}
	if err := json.NewDecoder(r.Body).Decode(activity); err != nil {
		return newJSONReqBodyServiceError(err, nil)
	}
	if err := srv.Db.CreateActivity(activity); err != nil {
		return newDatabaseServiceError(err, nil)
	}
	return writeJsonResponse(w, http.StatusOK, activity)
}
