package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerCoursesRoutes() {
	srv.Mux.Handle("GET /api/courses", srv.applyAdminMiddleware(srv.handleIndexCourses))
	srv.Mux.Handle("GET /api/courses/{id}", srv.applyMiddleware(srv.handleShowCourse))
	srv.Mux.Handle("POST /api/courses", srv.applyAdminMiddleware(srv.handleCreateCourse))
	srv.Mux.Handle("DELETE /api/courses/{id}", srv.applyAdminMiddleware(srv.handleDeleteCourse))
	srv.Mux.Handle("PATCH /api/courses/{id}", srv.applyAdminMiddleware(srv.handleUpdateCourse))
	srv.Mux.Handle("PUT /api/courses/{id}/save", srv.applyMiddleware(srv.handleFavoriteCourse))
}

/*
* @Query Params:
* ?page=: page
* ?perPage=: perPage
* ?sort=: sort
* ?search=: search
* ?searchFields=: searchFields
 */
func (srv *Server) handleIndexCourses(w http.ResponseWriter, r *http.Request, log sLog) error {
	page, perPage := srv.getPaginationInfo(r)
	search := r.URL.Query().Get("search")
	total, courses, err := srv.Db.GetCourse(page, perPage, search)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	last := srv.calculateLast(total, perPage)
	paginationData := models.PaginationMeta{
		PerPage:     perPage,
		LastPage:    int(last),
		CurrentPage: page,
		Total:       total,
	}
	return writePaginatedResponse(w, http.StatusOK, courses, paginationData)
}

func (srv *Server) handleShowCourse(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newBadRequestServiceError(err, "Invalid course ID")
	}
	course, err := srv.Db.GetCourseByID(id)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, course)
}

func (srv *Server) handleCreateCourse(w http.ResponseWriter, r *http.Request, log sLog) error {
	var course models.Course
	err := json.NewDecoder(r.Body).Decode(&course)
	defer r.Body.Close()
	if err != nil {
		return newBadRequestServiceError(err, "Invalid course data")
	}
	_, err = srv.Db.CreateCourse(&course)
	if err != nil {
		return newBadRequestServiceError(err, "Error creating course")
	}
	return writeJsonResponse(w, http.StatusCreated, "Course created successfully")
}

func (srv *Server) handleUpdateCourse(w http.ResponseWriter, r *http.Request, log sLog) error {
	var course models.Course
	err := json.NewDecoder(r.Body).Decode(&course)
	defer r.Body.Close()
	if err != nil {
		return newBadRequestServiceError(err, "Invalid course data")
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newBadRequestServiceError(err, "Invalid course ID")
	}
	toUpdate, err := srv.Db.GetCourseByID(id)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	models.UpdateStruct(&toUpdate, &course)
	updated, updateErr := srv.Db.UpdateCourse(toUpdate)
	if updateErr != nil {
		return newDatabaseServiceError(updateErr)
	}
	return writeJsonResponse(w, http.StatusOK, updated)
}

func (srv *Server) handleDeleteCourse(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newBadRequestServiceError(err, "Invalid course ID")
	}
	if err = srv.Db.DeleteCourse(id); err != nil {
		return newDatabaseServiceError(err)
	}
	log.info("Course deleted")
	return writeJsonResponse(w, http.StatusNoContent, "Course deleted successfully")
}

func (srv *Server) handleFavoriteCourse(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "course ID")
	}
	user_id := srv.userIdFromRequest(r)
	favoriteRemoved, err := srv.Db.ToggleUserFavorite(user_id, uint(id))
	if err != nil {
		log.add("course_id", id)
		log.add("user_id", user_id)
		return newDatabaseServiceError(err)
	}
	log.debugf("Favorite removed: %v", favoriteRemoved)
	if favoriteRemoved {
		w.WriteHeader(http.StatusNoContent)
		return nil
	}
	return writeJsonResponse(w, http.StatusOK, "Favorite updated successfully")
}
