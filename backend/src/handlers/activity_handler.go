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
	srv.Mux.Handle("GET /api/users/{id}/activity", srv.applyMiddleware(http.HandlerFunc(srv.HandleGetActivityByUserID)))
	srv.Mux.Handle("GET /api/users/{id}/daily-activity", srv.applyMiddleware(http.HandlerFunc(srv.HandleGetDailyActivityByUserID)))
	srv.Mux.Handle("GET /api/programs/{id}/activity", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleGetProgramActivity)))
	srv.Mux.Handle("POST /api/users/{id}/activity", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleCreateActivity)))
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
	if err = srv.WriteResponse(w, http.StatusOK, map[string]interface{}{
		"activities": activities,
	}); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, "Failed to write response")
		log.Error("Failed to write response", err)
	}
}

/****
 * @Query Params:
 * ?year=: year (default last year)
 ****/
 func (srv *Server) HandleGetDailyActivityByUserID(w http.ResponseWriter, r *http.Request) {
	// Parse userID from path
	userID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	// Get year from query param
	yearStr := r.URL.Query().Get("year")

	// Convert year parameter to integer
	var year int
	if yearStr != "" {
		year, err = strconv.Atoi(yearStr)
		if err != nil {
			srv.ErrorResponse(w, http.StatusBadRequest, "Invalid year parameter")
			return
		}
	}

	// Retrieve daily activities for the given userID and year
	activities, err := srv.Db.GetDailyActivityByUserID(userID, year)
	if err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, "Failed to get activities")
		return
	}

	// Write response
	if err = srv.WriteResponse(w, http.StatusOK, map[string]interface{}{
		"activities": activities,
	}); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, "Failed to write response")
		log.Error("Failed to write response", err)
	}
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
	if err = srv.WriteResponse(w, http.StatusOK, map[string]interface{}{
		"count":      count,
		"activities": activities,
	}); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, "Failed to write response")
		log.Error("Failed to write response", err)
	}
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
	if err := srv.WriteResponse(w, http.StatusOK, activity); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, "Failed to write response")
		log.Error("Failed to write response", err)
	}
}
