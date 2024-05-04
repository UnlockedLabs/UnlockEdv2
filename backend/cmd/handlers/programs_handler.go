package handlers

import (
	"Go-Prototype/backend/cmd/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerProgramsRoutes() {
	srv.Mux.Handle("GET /api/programs", srv.applyMiddleware(http.HandlerFunc(srv.handleIndexPrograms)))
	srv.Mux.Handle("GET /api/programs/{id}", srv.applyMiddleware(http.HandlerFunc(srv.handleShowProgram)))
	srv.Mux.Handle("POST /api/programs", srv.applyMiddleware(http.HandlerFunc(srv.handleCreateProgram)))
	srv.Mux.Handle("DELETE /api/programs/{id}", srv.applyMiddleware(http.HandlerFunc(srv.handleDeleteProgram)))
	srv.Mux.Handle("PATCH /api/programs/{id}", srv.applyMiddleware(http.HandlerFunc(srv.handleUpdateProgram)))
}

func (srv *Server) handleIndexPrograms(w http.ResponseWriter, r *http.Request) {
	page, perPage := srv.GetPaginationInfo(r)
	total, programs, err := srv.Db.GetProgram(page, perPage)
	if err != nil {
		srv.Logger.Debug("IndexPrograms Database Error: %v", err)
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
	srv.Logger.Debug("IndexPrograms: %v", programs)
	response := models.PaginatedResource[models.Program]{
		Meta: paginationData,
		Data: programs,
	}
	if err = srv.WriteResponse(w, http.StatusOK, response); err != nil {
		srv.LogError("Error writing response: " + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
}

func (srv *Server) handleShowProgram(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.Logger.Debug("GET Program handler Error: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
	}
	program, err := srv.Db.GetProgramByID(id)
	if err != nil {
		srv.Logger.Debug("GET Program handler Error: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
	}
	if err = srv.WriteResponse(w, http.StatusOK, program); err != nil {
		srv.LogError("Error writing response: " + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
}

func (srv *Server) handleCreateProgram(w http.ResponseWriter, r *http.Request) {
	var program models.Program
	err := json.NewDecoder(r.Body).Decode(&program)
	defer r.Body.Close()
	if err != nil {
		srv.LogError("CreateProgram Error:" + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	_, err = srv.Db.CreateProgram(&program)
	if err != nil {
		srv.LogError("Error creating program:" + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (srv *Server) handleUpdateProgram(w http.ResponseWriter, r *http.Request) {
	var program models.Program
	err := json.NewDecoder(r.Body).Decode(&program)
	defer r.Body.Close()
	if err != nil {
		srv.LogError("UpdateProgram Error:" + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.Logger.Debug("GET Program handler Error: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
	}
	toUpdate, err := srv.Db.GetProgramByID(id)
	if err != nil {
		srv.LogError("Error getting program:" + err.Error())
	}
	models.UpdateStruct(&toUpdate, &program)
	updated, updateErr := srv.Db.UpdateProgram(toUpdate)
	if updateErr != nil {
		srv.LogError("Error updating program:" + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := srv.WriteResponse(w, http.StatusOK, updated); err != nil {
		srv.LogError("Error writing response: " + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
}

func (srv *Server) handleDeleteProgram(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.LogError("DELETE Program handler Error: " + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	if err = srv.Db.DeleteProgram(id); err != nil {
		srv.LogError("Error deleting program:" + err.Error())
	}
	srv.LogInfo("Program deleted")
	w.WriteHeader(http.StatusNoContent)
}
