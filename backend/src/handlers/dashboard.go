package handlers

import (
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerDashboardRoutes() {
	srv.Mux.Handle("GET /api/users/{id}/dashboard", srv.applyMiddleware(http.HandlerFunc(srv.HandleUserDashboard)))
	srv.Mux.Handle("GET /api/users/{id}/catalogue", srv.applyMiddleware(http.HandlerFunc(srv.HandleUserCatalogue)))
	srv.Mux.Handle("GET /api/users/{id}/programs", srv.applyMiddleware(http.HandlerFunc(srv.HandleUserPrograms)))
}

func (srv *Server) HandleUserDashboard(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleUserDashboard",
		"route":   "GET /api/users/{id}/dashboard",
	}
	userId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.WithFields(logFields).Errorf("Error parsing user ID from URL: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	logFields["userId"] = userId
	userDashboard, err := srv.Db.GetUserDashboardInfo(userId)
	if err != nil {
		logFields["databaseMethod"] = "GetUserDashboardInfo"
		log.WithFields(logFields).Errorf("Error getting user dashboard info: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := srv.WriteResponse(w, http.StatusOK, userDashboard); err != nil {
		log.WithFields(logFields).Errorf("Error writing response when fetching user dashboard: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
}

/**
* GET: /api/users/{id}/catalogue
* @Query Params:
* tag: any number of tags to filter by
* ?tag=some_tag&tag=another_tag
* provider_id: provider id to filter by
**/
func (srv *Server) HandleUserCatalogue(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleUserCatalogue",
		"route":   "GET /api/users/{id}/catalogue",
	}
	userId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.WithFields(logFields).Errorf("Error parsing user ID from URL: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	logFields["userId"] = userId
	tags := r.URL.Query()["tags"]
	userCatalogue, err := srv.Db.GetUserCatalogue(userId, tags)
	if err != nil {
		logFields["databaseMethod"] = "GetUserCatalogue"
		log.WithFields(logFields).Errorf("Error getting user catalogue info: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := srv.WriteResponse(w, http.StatusOK, userCatalogue); err != nil {
		log.WithFields(logFields).Errorf("Error writing response when fetching user catalogue: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
}

func (srv *Server) HandleUserPrograms(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleUserPrograms",
		"route":   "GET /api/users/{id}/programs",
	}
	userId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.WithFields(logFields).Errorf("Error parsing user ID from URL: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	logFields["userId"] = userId
	if !srv.canViewUserData(r) {
		srv.ErrorResponse(w, http.StatusForbidden, "You do not have permission to view this user's programs")
		return
	}
	tags := r.URL.Query()["tags"]
	userPrograms, numCompleted, totalTime, err := srv.Db.GetUserPrograms(uint(userId), tags)
	if err != nil {
		logFields["databaseMethod"] = "GetUserPrograms"
		log.WithFields(logFields).Errorf("Error getting user programs: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	response := map[string]interface{}{
		"programs":      userPrograms,
		"num_completed": numCompleted,
		"total_time":    totalTime,
	}
	if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
		log.Errorf("user programs endpoint: error writing response: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
}
