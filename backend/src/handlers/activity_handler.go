package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerActivityRoutes() {
	srv.Mux.Handle("GET /api/users/{id}/activity", srv.applyMiddleware(srv.HandleGetActivityByUserID))
	srv.Mux.Handle("GET /api/users/{id}/daily-activity", srv.applyMiddleware(srv.HandleGetDailyActivityByUserID))
	srv.Mux.Handle("GET /api/programs/{id}/activity", srv.ApplyAdminMiddleware(srv.HandleGetProgramActivity))
	srv.Mux.Handle("POST /api/users/{id}/activity", srv.ApplyAdminMiddleware(srv.HandleCreateActivity))
}

func (srv *Server) HandleGetActivityByUserID(w http.ResponseWriter, r *http.Request) {
	year := r.URL.Query().Get("year")
	if year == "" {
		year = fmt.Sprintf("%d", time.Now().Year())
	}
	yearInt, err := strconv.Atoi(year)
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid year")
		return
	}
	userID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid user ID")
		return
	}
	activities, err := srv.Db.GetActivityByUserID(uint(userID), yearInt)
	if err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, "Failed to get activities")
		return
	}
	writeJsonResponse(w, http.StatusOK, map[string]interface{}{
		"activities": activities,
	})
}

/****
 * @Query Params:
 * ?year=: year (default last year)
 ****/
func (srv *Server) HandleGetDailyActivityByUserID(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "HandleGetDailyActivityByUserID"}
	userID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid user ID")
		return
	}
	fields["user_id"] = userID
	requestingUser := int(srv.GetUserID(r))
	if requestingUser != userID && !srv.UserIsAdmin(r) {
		log.WithFields(fields).Error("Non admin requesting to view other student activities")
		srv.ErrorResponse(w, http.StatusForbidden, "You do not have permission to view this user's activities")
		return
	}
	yearStr := r.URL.Query().Get("year")
	var year int
	if yearStr != "" {
		year, err = strconv.Atoi(yearStr)
		if err != nil {
			fields["error"] = err.Error()
			log.WithFields(fields).Error("Invalid year parameter")
			srv.ErrorResponse(w, http.StatusBadRequest, "Invalid year parameter")
			return
		}
	}
	activities, err := srv.Db.GetDailyActivityByUserID(userID, year)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Failed to get activities")
		srv.ErrorResponse(w, http.StatusInternalServerError, "Failed to get activities")
		return
	}
	writeJsonResponse(w, http.StatusOK, map[string]interface{}{
		"activities": activities,
	})
}

func (srv *Server) HandleGetProgramActivity(w http.ResponseWriter, r *http.Request) {
	programID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid program ID")
		return
	}
	page, perPage := srv.GetPaginationInfo(r)
	count, activities, err := srv.Db.GetActivityByProgramID(page, perPage, programID)
	if err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, "Failed to get activities")
		return
	}
	writeJsonResponse(w, http.StatusOK, map[string]interface{}{
		"count":      count,
		"activities": activities,
	})
}

func (srv *Server) HandleCreateActivity(w http.ResponseWriter, r *http.Request) {
	activity := &models.Activity{}
	if err := json.NewDecoder(r.Body).Decode(activity); err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := srv.Db.CreateActivity(activity); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, "Failed to create activity")
		return
	}
	writeJsonResponse(w, http.StatusOK, activity)
}
