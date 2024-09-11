package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerCoursesRoutes() {
	srv.Mux.Handle("GET /api/courses", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleIndexCourses)))
	srv.Mux.Handle("GET /api/courses/{id}", srv.applyMiddleware(http.HandlerFunc(srv.HandleShowCourse)))
	srv.Mux.Handle("POST /api/courses", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleCreateCourse)))
	srv.Mux.Handle("DELETE /api/courses/{id}", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleDeleteCourse)))
	srv.Mux.Handle("PATCH /api/courses/{id}", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleUpdateCourse)))
	srv.Mux.Handle("PUT /api/courses/{id}/save", srv.applyMiddleware(http.HandlerFunc(srv.HandleFavoriteCourse)))
}

/*
* @Query Params:
* ?page=: page
* ?perPage=: perPage
* ?sort=: sort
* ?search=: search
* ?searchFields=: searchFields
 */
func (srv *Server) HandleIndexCourses(w http.ResponseWriter, r *http.Request) {
	page, perPage := srv.GetPaginationInfo(r)
	search := r.URL.Query().Get("search")
	total, courses, err := srv.Db.GetCourse(page, perPage, search)
	if err != nil {
		log.Debug("IndexCourses Database Error: ", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, "Error fetching courses from database")
		return
	}
	last := srv.CalculateLast(total, perPage)
	paginationData := models.PaginationMeta{
		PerPage:     perPage,
		LastPage:    int(last),
		CurrentPage: page,
		Total:       total,
	}
	writePaginatedResponse(w, http.StatusOK, courses, paginationData)
}

func (srv *Server) HandleShowCourse(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Debug("GET Course handler Error: ", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	course, err := srv.Db.GetCourseByID(id)
	if err != nil {
		log.Debug("GET Course handler Error: ", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJsonResponse(w, http.StatusOK, course)
}

func (srv *Server) HandleCreateCourse(w http.ResponseWriter, r *http.Request) {
	var course models.Course
	err := json.NewDecoder(r.Body).Decode(&course)
	defer r.Body.Close()
	if err != nil {
		log.Error("CreateCourse Error:" + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	_, err = srv.Db.CreateCourse(&course)
	if err != nil {
		log.Error("Error creating course:" + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJsonResponse(w, http.StatusCreated, "Course created successfully")
}

func (srv *Server) HandleUpdateCourse(w http.ResponseWriter, r *http.Request) {
	var course models.Course
	err := json.NewDecoder(r.Body).Decode(&course)
	defer r.Body.Close()
	if err != nil {
		log.Error("UpdateCourse Error:" + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Debug("GET Course handler Error: ", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
	}
	toUpdate, err := srv.Db.GetCourseByID(id)
	if err != nil {
		log.Error("Error getting course:" + err.Error())
	}
	models.UpdateStruct(&toUpdate, &course)
	updated, updateErr := srv.Db.UpdateCourse(toUpdate)
	if updateErr != nil {
		log.Error("Error updating course:" + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJsonResponse(w, http.StatusOK, updated)
}

func (srv *Server) HandleDeleteCourse(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Error("DELETE Course handler Error: " + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	if err = srv.Db.DeleteCourse(id); err != nil {
		log.Error("Error deleting course:" + err.Error())
		srv.ErrorResponse(w, http.StatusNotFound, err.Error())
		return
	}
	log.Info("Course deleted")
	writeJsonResponse(w, http.StatusNoContent, "Course deleted successfully")
}

func (srv *Server) HandleFavoriteCourse(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Error("Favorite Course handler Error: " + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}

	user_id := srv.GetUserID(r)
	var favorite models.UserFavorite
	if srv.Db.First(&favorite, "user_id = ? AND course_id = ?", user_id, id).Error == nil {
		if err = srv.Db.Delete(&favorite).Error; err != nil {
			log.Error("Error deleting favorite: " + err.Error())
			srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	} else {
		favorite = models.UserFavorite{UserID: user_id, CourseID: uint(id)}
		if err = srv.Db.Create(&favorite).Error; err != nil {
			log.Error("Error creating favorite: " + err.Error())
			srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
			return
		}
	}
	writeJsonResponse(w, http.StatusOK, "Favorite updated successfully")
}
