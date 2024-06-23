package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerProgramsRoutes() {
	srv.Mux.Handle("GET /api/programs", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleIndexPrograms)))
	srv.Mux.Handle("GET /api/programs/{id}", srv.applyMiddleware(http.HandlerFunc(srv.HandleShowProgram)))
	srv.Mux.Handle("POST /api/programs", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleCreateProgram)))
	srv.Mux.Handle("DELETE /api/programs/{id}", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleDeleteProgram)))
	srv.Mux.Handle("PATCH /api/programs/{id}", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleUpdateProgram)))
	srv.Mux.Handle("PUT /api/programs/{id}/save", srv.applyMiddleware(http.HandlerFunc(srv.HandleFavoriteProgram)))
}

/*
* @Query Params:
* ?page=: page
* ?perPage=: perPage
* ?sort=: sort
* ?search=: search
* ?searchFields=: searchFields
 */
func (srv *Server) HandleIndexPrograms(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleIndexPrograms",
		"route":   "GET /api/programs",
	}
	page, perPage := srv.GetPaginationInfo(r)
	search := r.URL.Query().Get("search")
	total, programs, err := srv.Db.GetProgram(page, perPage, search)
	if err != nil {
		log.WithFields(logFields).Errorf("Error getting programs: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	last := srv.CalculateLast(total, perPage)
	paginationData := models.PaginationMeta{
		PerPage:     perPage,
		LastPage:    int(last),
		CurrentPage: page,
		Total:       total,
	}
	response := models.PaginatedResource[models.Program]{
		Meta: paginationData,
		Data: programs,
	}
	if err = srv.WriteResponse(w, http.StatusOK, response); err != nil {
		log.WithFields(logFields).Errorf("Error writing response: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
}

func (srv *Server) HandleShowProgram(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleShowProgram",
		"route":   "GET /api/programs/{id}",
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.WithFields(logFields).Errorf("Error getting program id from URL: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	logFields["program is"] = id
	program, err := srv.Db.GetProgramByID(id)
	if err != nil {
		logFields["databaseMethod"] = "GetProgramByID"
		log.WithFields(logFields).Errorf("Error getting program: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	if err = srv.WriteResponse(w, http.StatusOK, program); err != nil {
		log.WithFields(logFields).Errorf("Error writing response: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
}

func (srv *Server) HandleCreateProgram(w http.ResponseWriter, r *http.Request) {
	var program models.Program
	logFields := log.Fields{
		"handler": "HandleCreateProgram",
		"route":   "POST /api/programs",
	}
	err := json.NewDecoder(r.Body).Decode(&program)
	defer r.Body.Close()
	if err != nil {
		log.WithFields(logFields).Errorf("Error decoding request body: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	logFields["program"] = program.Name
	_, err = srv.Db.CreateProgram(&program)
	if err != nil {
		logFields["databaseMethod"] = "CreateProgram"
		log.WithFields(logFields).Errorf("Error creating program: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (srv *Server) HandleUpdateProgram(w http.ResponseWriter, r *http.Request) {
	var program models.Program
	logFields := log.Fields{
		"handler": "HandleUpdateProgram",
		"route":   "PATCH /api/programs/{id}",
	}
	err := json.NewDecoder(r.Body).Decode(&program)
	defer r.Body.Close()
	if err != nil {
		log.WithFields(logFields).Errorf("Error decoding request body: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.WithFields(logFields).Errorf("Error getting program id from URL: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
	}
	logFields["programId"] = id
	toUpdate, err := srv.Db.GetProgramByID(id)
	if err != nil {
		logFields["databaseMethod"] = "GetProgramByID"
		log.WithFields(logFields).Errorf("Error getting program: %v", err)
		delete(logFields, "databaseMethod")
	}
	models.UpdateStruct(&toUpdate, &program)
	updated, updateErr := srv.Db.UpdateProgram(toUpdate)
	if updateErr != nil {
		logFields["databaseMethod"] = "UpdateProgram"
		log.WithFields(logFields).Errorf("Error updating program: %v", updateErr)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := srv.WriteResponse(w, http.StatusOK, updated); err != nil {
		log.WithFields(logFields).Errorf("Error writing response: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
}

func (srv *Server) HandleDeleteProgram(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleDeleteProgram",
		"route":   "DELETE /api/programs/{id}",
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.WithFields(logFields).Errorf("Error getting program id from URL: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	logFields["programId"] = id
	if err = srv.Db.DeleteProgram(id); err != nil {
		logFields["databaseMethod"] = "DeleteProgram"
		log.WithFields(logFields).Errorf("Error deleting program: %v", err)
		srv.ErrorResponse(w, http.StatusNotFound, err.Error())
		return
	}
	log.WithField("id", id).Info("Program deleted")
	w.WriteHeader(http.StatusNoContent)
}

func (srv *Server) HandleFavoriteProgram(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleFavoriteProgram",
		"route":   "PUT /api/programs/{id}/save",
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.WithFields(logFields).Errorf("Error getting program id from URL: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	user_id := srv.GetUserID(r)
	logFields["programId"] = id
	logFields["userId"] = user_id
	var favorite models.UserFavorite
	err = srv.Db.Conn.Model(models.UserFavorite{}).Where("user_id = ? AND program_id = ?", user_id, id).First(&favorite).Error
	if err != nil {
		log.WithFields(logFields).Errorf("Favorite not found, creating new favorite")
		favorite = models.UserFavorite{
			UserID:    user_id,
			ProgramID: uint(id),
		}
		if err = srv.Db.Conn.Create(&favorite).Error; err != nil {
			log.WithFields(logFields).Errorf("Error creating favorite: %v", err)
			srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
			return
		}
	} else {
		if err = srv.Db.Conn.Delete(&favorite).Error; err != nil {
			log.WithFields(logFields).Errorf("Error deleting favorite: %v", err)
			srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
			return
		}
		if err := srv.WriteResponse(w, http.StatusNoContent, nil); err != nil {
			log.WithFields(logFields).Errorf("Error writing response: %v", err)
			srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
			return
		}
	}
	if err := srv.WriteResponse(w, http.StatusOK, nil); err != nil {
		log.WithFields(logFields).Errorf("Error writing response: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
}
