package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerProgramsRoutes() {
	srv.Mux.Handle("GET /api/programs", srv.applyMiddleware(http.HandlerFunc(srv.HandleIndexPrograms)))
	srv.Mux.Handle("GET /api/programs/{id}", srv.applyMiddleware(http.HandlerFunc(srv.HandleShowProgram)))
	srv.Mux.Handle("POST /api/programs", srv.applyMiddleware(http.HandlerFunc(srv.HandleCreateProgram)))
	srv.Mux.Handle("DELETE /api/programs/{id}", srv.applyMiddleware(http.HandlerFunc(srv.HandleDeleteProgram)))
	srv.Mux.Handle("PATCH /api/programs/{id}", srv.applyMiddleware(http.HandlerFunc(srv.HandleUpdateProgram)))
}

func (srv *Server) HandleIndexPrograms(w http.ResponseWriter, r *http.Request) {
	page, perPage := srv.GetPaginationInfo(r)
	total, programs, err := srv.Db.GetProgram(page, perPage)
	if err != nil {
		log.Debug("IndexPrograms Database Error: ", err)
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
		log.Error("Error writing response: " + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
}

func (srv *Server) HandleShowProgram(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Debug("GET Program handler Error: ", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	program, err := srv.Db.GetProgramByID(id)
	if err != nil {
		log.Debug("GET Program handler Error: ", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	if err = srv.WriteResponse(w, http.StatusOK, program); err != nil {
		log.Error("Error writing response: " + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
}

func (srv *Server) HandleCreateProgram(w http.ResponseWriter, r *http.Request) {
	var program models.Program
	err := json.NewDecoder(r.Body).Decode(&program)
	defer r.Body.Close()
	if err != nil {
		log.Error("CreateProgram Error:" + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	_, err = srv.Db.CreateProgram(&program)
	if err != nil {
		log.Error("Error creating program:" + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (srv *Server) HandleUpdateProgram(w http.ResponseWriter, r *http.Request) {
	var program models.Program
	err := json.NewDecoder(r.Body).Decode(&program)
	defer r.Body.Close()
	if err != nil {
		log.Error("UpdateProgram Error:" + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Debug("GET Program handler Error: ", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
	}
	toUpdate, err := srv.Db.GetProgramByID(id)
	if err != nil {
		log.Error("Error getting program:" + err.Error())
	}
	models.UpdateStruct(&toUpdate, &program)
	updated, updateErr := srv.Db.UpdateProgram(toUpdate)
	if updateErr != nil {
		log.Error("Error updating program:" + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := srv.WriteResponse(w, http.StatusOK, updated); err != nil {
		log.Error("Error writing response: " + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
}

func (srv *Server) HandleDeleteProgram(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Error("DELETE Program handler Error: " + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	if err = srv.Db.DeleteProgram(id); err != nil {
		log.Error("Error deleting program:" + err.Error())
		srv.ErrorResponse(w, http.StatusNotFound, err.Error())
		return
	}
	log.Info("Program deleted")
	w.WriteHeader(http.StatusNoContent)
}
