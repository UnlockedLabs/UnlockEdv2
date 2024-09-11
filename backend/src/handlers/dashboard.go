package handlers

import (
	"net/http"
	"strconv"
	"strings"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerDashboardRoutes() {
	srv.Mux.Handle("GET /api/users/{id}/student-dashboard", srv.applyMiddleware(srv.HandleError(srv.HandleStudentDashboard)))
	srv.Mux.Handle("GET /api/users/{id}/admin-dashboard", srv.ApplyAdminMiddleware(srv.HandleError(srv.HandleAdminDashboard)))
	srv.Mux.Handle("GET /api/users/{id}/catalogue", srv.applyMiddleware(srv.HandleError(srv.HandleUserCatalogue)))
	srv.Mux.Handle("GET /api/users/{id}/courses", srv.applyMiddleware(srv.HandleError(srv.HandleUserCourses)))
}

func (srv *Server) HandleStudentDashboard(w http.ResponseWriter, r *http.Request) error {
	fields := log.Fields{"handler": "HandleStudentDashboard"}
	faciltiyId := srv.getFacilityID(r)
	userId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		fields["error"] = err.Error()
		return newInvalidIdServiceError(err, "user ID", fields)
	}
	studentDashboard, err := srv.Db.GetStudentDashboardInfo(userId, faciltiyId)
	if err != nil {
		fields["error"] = err.Error()
		return newDatabaseServiceError(err, fields)
	}
	return writeJsonResponse(w, http.StatusOK, studentDashboard)
}

func (srv *Server) HandleAdminDashboard(w http.ResponseWriter, r *http.Request) error {
	fields := log.Fields{"handler": "HandleAdminDashboard"}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	adminDashboard, err := srv.Db.GetAdminDashboardInfo(claims.FacilityID)
	if err != nil {
		fields["error"] = err.Error()
		return newDatabaseServiceError(err, fields)
	}
	return writeJsonResponse(w, http.StatusOK, adminDashboard)
}

/**
* GET: /api/users/{id}/catalogue
* @Query Params:
* tag: any number of tags to filter by
* ?tag=some_tag&tag=another_tag
* provider_id: provider id to filter by
**/
func (srv *Server) HandleUserCatalogue(w http.ResponseWriter, r *http.Request) error {
	userId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID", nil)
	}
	tags := r.URL.Query()["tags"]
	search := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("search")))
	order := r.URL.Query().Get("order")
	userCatalogue, err := srv.Db.GetUserCatalogue(userId, tags, search, order)
	if err != nil {
		return newDatabaseServiceError(err, nil)
	}
	return writeJsonResponse(w, http.StatusOK, userCatalogue)
}

func (srv *Server) HandleUserCourses(w http.ResponseWriter, r *http.Request) error {
	userId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID", nil)
	}
	if !srv.canViewUserData(r) {
		return newForbiddenServiceError(err, "You do not have permission to view this user's courses", nil)
	}
	order := r.URL.Query().Get("order")
	orderBy := r.URL.Query().Get("order_by")
	search := r.URL.Query().Get("search")
	search = strings.ToLower(search)
	search = strings.TrimSpace(search)
	tags := r.URL.Query()["tags"]
	userCourses, numCompleted, totalTime, err := srv.Db.GetUserCourses(uint(userId), order, orderBy, search, tags)
	if err != nil {
		return newDatabaseServiceError(err, nil)
	}
	response := map[string]interface{}{
		"courses":       userCourses,
		"num_completed": numCompleted,
		"total_time":    totalTime,
	}
	return writeJsonResponse(w, http.StatusOK, response)
}
