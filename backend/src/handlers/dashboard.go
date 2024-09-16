package handlers

import (
	"net/http"
	"strconv"
	"strings"
)

func (srv *Server) registerDashboardRoutes() {
	srv.Mux.Handle("GET /api/users/{id}/student-dashboard", srv.applyMiddleware(srv.handleStudentDashboard))
	srv.Mux.Handle("GET /api/users/{id}/admin-dashboard", srv.applyAdminMiddleware(srv.handleAdminDashboard))
	srv.Mux.Handle("GET /api/users/{id}/catalogue", srv.applyMiddleware(srv.handleUserCatalogue))
	srv.Mux.Handle("GET /api/users/{id}/courses", srv.applyMiddleware(srv.handleUserCourses))
}

func (srv *Server) handleStudentDashboard(w http.ResponseWriter, r *http.Request, log sLog) error {
	faciltiyId := srv.getFacilityID(r)
	userId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	studentDashboard, err := srv.Db.GetStudentDashboardInfo(userId, faciltiyId)
	if err != nil {
		log.add("faciltiyId", faciltiyId)
		log.add("userId", userId)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, studentDashboard)
}

func (srv *Server) handleAdminDashboard(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims := r.Context().Value(ClaimsKey).(*Claims)
	adminDashboard, err := srv.Db.GetAdminDashboardInfo(claims.FacilityID)
	if err != nil {
		log.add("facilityId", claims.FacilityID)
		return newDatabaseServiceError(err)
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
func (srv *Server) handleUserCatalogue(w http.ResponseWriter, r *http.Request, log sLog) error {
	userId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	tags := r.URL.Query()["tags"]
	search := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("search")))
	order := r.URL.Query().Get("order")
	userCatalogue, err := srv.Db.GetUserCatalogue(userId, tags, search, order)
	if err != nil {
		log.add("userId", userId)
		log.add("search", search)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, userCatalogue)
}

func (srv *Server) handleUserCourses(w http.ResponseWriter, r *http.Request, log sLog) error {
	userId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	log.add("user_id", userId)
	if !srv.canViewUserData(r) {
		return newForbiddenServiceError(err, "You do not have permission to view this user's courses")
	}
	order := r.URL.Query().Get("order")
	orderBy := r.URL.Query().Get("order_by")
	search := r.URL.Query().Get("search")
	search = strings.ToLower(search)
	search = strings.TrimSpace(search)
	tags := r.URL.Query()["tags"]
	userCourses, numCompleted, totalTime, err := srv.Db.GetUserCourses(uint(userId), order, orderBy, search, tags)
	if err != nil {
		log.add("search", search)
		return newDatabaseServiceError(err)
	}
	response := map[string]interface{}{
		"courses":       userCourses,
		"num_completed": numCompleted,
		"total_time":    totalTime,
	}
	return writeJsonResponse(w, http.StatusOK, response)
}
