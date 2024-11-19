package handlers

import (
	"UnlockEdv2/src/models"
	"net/http"
	"strconv"
)

func (srv *Server) registerCoursesRoutes() []routeDef {
	axx := models.Feature(models.ProviderAccess)
	return []routeDef{
		{"GET /api/courses", srv.handleIndexCourses, true, axx},
		{"GET /api/courses/{id}", srv.handleShowCourse, false, axx},
		{"PUT /api/courses/{id}/save", srv.handleFavoriteCourse, true, axx},
	}
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
