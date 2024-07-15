package handlers

import (
	"net/http"
	"strconv"
	"strings"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerDashboardRoutes() {
	srv.Mux.Handle("GET /api/users/{id}/student-dashboard", srv.applyMiddleware(http.HandlerFunc(srv.HandleStudentDashboard)))
	srv.Mux.Handle("GET /api/users/{id}/admin-dashboard", srv.applyMiddleware(http.HandlerFunc(srv.HandleAdminDashboard)))
	srv.Mux.Handle("GET /api/users/{id}/catalogue", srv.applyMiddleware(http.HandlerFunc(srv.HandleUserCatalogue)))
	srv.Mux.Handle("GET /api/users/{id}/programs", srv.applyMiddleware(http.HandlerFunc(srv.HandleUserPrograms)))
}

func (srv *Server) HandleStudentDashboard(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "HandleStudentDashboard"}
	userId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Errorf("Error parsing user ID: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	studentDashboard, err := srv.Db.GetStudentDashboardInfo(userId)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Errorf("Error getting user dashboard info: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	srv.WriteResponse(w, http.StatusOK, studentDashboard)
}

func (srv *Server) HandleAdminDashboard(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "HandleAdminDashboard"}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	adminDashboard, err := srv.Db.GetAdminDashboardInfo(claims.FacilityID)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Errorf("Error getting user dashboard info: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	srv.WriteResponse(w, http.StatusOK, adminDashboard)
}

/**
* GET: /api/users/{id}/catalogue
* @Query Params:
* tag: any number of tags to filter by
* ?tag=some_tag&tag=another_tag
* provider_id: provider id to filter by
**/
func (srv *Server) HandleUserCatalogue(w http.ResponseWriter, r *http.Request) {
	userId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Errorf("Error parsing user ID: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	tags := r.URL.Query()["tags"]
	userCatalogue, err := srv.Db.GetUserCatalogue(userId, tags)
	if err != nil {
		log.Errorf("Error getting user catalogue info: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	srv.WriteResponse(w, http.StatusOK, userCatalogue)
}

func (srv *Server) HandleUserPrograms(w http.ResponseWriter, r *http.Request) {
	userId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Errorf("Error parsing user ID: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	if !srv.canViewUserData(r) {
		srv.ErrorResponse(w, http.StatusForbidden, "You do not have permission to view this user's programs")
		return
	}
	order := r.URL.Query().Get("order")
	orderBy := r.URL.Query().Get("orderby")
	search := r.URL.Query().Get("search")
	search = strings.ToLower(search)
	search = strings.TrimSpace(search)
	tags := r.URL.Query()["tags"]
	userPrograms, numCompleted, totalTime, err := srv.Db.GetUserPrograms(uint(userId), order, orderBy, search, tags)
	if err != nil {
		log.Errorf("Error getting user programs: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	response := map[string]interface{}{
		"programs":      userPrograms,
		"num_completed": numCompleted,
		"total_time":    totalTime,
	}
	srv.WriteResponse(w, http.StatusOK, response)
}
