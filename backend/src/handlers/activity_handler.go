package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerActivityRoutes() {
	srv.Mux.Handle("GET /api/users/{id}/activity", srv.applyMiddleware(http.HandlerFunc(srv.HandleGetActivityByUserID)))
	srv.Mux.Handle("GET /api/users/{id}/daily-activity", srv.applyMiddleware(http.HandlerFunc(srv.HandleGetDailyActivityByUserID)))
	srv.Mux.Handle("GET /api/programs/{id}/activity", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleGetProgramActivity)))
	srv.Mux.Handle("POST /api/users/{id}/activity", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleCreateActivity)))
}

func (srv *Server) HandleGetActivityByUserID(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleGetActivityByUserID",
		"route":   "GET /api/users/{id}/activity",
	}
	userID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Errorf("Error parsing user ID from URL: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	logFields["userId"] = userID
	count, activities, err := srv.Db.GetActivityByUserID(1, 365, userID)
	if err != nil {
		logFields["databaseMethod"] = "GetActivityByUserID"
		log.WithFields(logFields).Errorf("Failed to get activity for user: %v ", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, "Failed to get activities")
		return
	}
	if err = srv.WriteResponse(w, http.StatusOK, map[string]interface{}{
		"count":      count,
		"activities": activities,
	}); err != nil {
		log.WithFields(logFields).Errorf("Failed to write response when fetching activity for user: %v ", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, "Failed to write response")
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
		log.WithFields(log.Fields{
			"handler":        "HandleGetDailyActivityByUserID",
			"route":          "GET /api/users/{id}/daily-activity",
			"databaseMethod": "GetDailyActivityByUserID",
		}).Errorf("Failed to get daily activities for user: %v", err)
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
	logFields := log.Fields{
		"handler": "HandleGetProgramActivity",
		"route":   "GET /api/programs/{id}/activity",
	}
	programID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.WithFields(logFields).Errorf("Error parsing program ID from URL: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid program ID")
		return
	}
	logFields["programID"] = programID
	page, perPage := srv.GetPaginationInfo(r)
	count, activities, err := srv.Db.GetActivityByProgramID(page, perPage, programID)
	if err != nil {
		logFields["databaseMethod"] = "GetActivityByProgramID"
		log.WithFields(logFields).Errorf("Failed to get activity for program: %v ", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, "Failed to get activities")
		return
	}
	if err = srv.WriteResponse(w, http.StatusOK, map[string]interface{}{
		"count":      count,
		"activities": activities,
	}); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, "Failed to write response")
		log.WithFields(logFields).Errorf("Failed to write response when fetching program activity: %v ", err)
	}
}

func (srv *Server) HandleCreateActivity(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleCreateActivity",
		"route":   "POST /api/users/{id}/activity",
	}
	activity := &models.Activity{}
	if err := json.NewDecoder(r.Body).Decode(activity); err != nil {
		log.WithFields(logFields).Errorf("Error decoding request body: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	logFields["userId"] = activity.UserID
	logFields["programId"] = activity.ProgramID
	if err := srv.Db.CreateActivity(activity); err != nil {
		logFields["databaseMethod"] = "CreateActivity"
		log.WithFields(logFields).Errorf("Failed to create activity: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, "Failed to create activity")
		return
	}
	if err := srv.WriteResponse(w, http.StatusOK, activity); err != nil {
		log.WithFields(logFields).Errorf("Failed to write response when creating activity: %v ", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, "Failed to write response")
	}
}
