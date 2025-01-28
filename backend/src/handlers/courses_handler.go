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
	args := srv.getQueryArgs(r)
	courses, err := srv.Db.GetCourses(&args)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, courses, args.IntoMeta())
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
