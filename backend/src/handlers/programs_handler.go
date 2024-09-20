package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerProgramsRoutes() {
	srv.Mux.Handle("GET /api/programs", srv.applyAdminMiddleware(http.HandlerFunc(srv.handleError(srv.handleIndexPrograms))))
	srv.Mux.Handle("GET /api/programs/{id}", srv.applyMiddleware(http.HandlerFunc(srv.handleError(srv.handleShowProgram))))
	srv.Mux.Handle("POST /api/programs", srv.applyAdminMiddleware(http.HandlerFunc(srv.handleError(srv.handleCreateProgram))))
	srv.Mux.Handle("DELETE /api/programs/{id}", srv.applyAdminMiddleware(http.HandlerFunc(srv.handleError(srv.handleDeleteProgram))))
	srv.Mux.Handle("PATCH /api/programs/{id}", srv.applyAdminMiddleware(http.HandlerFunc(srv.handleError(srv.handleUpdateProgram))))
	srv.Mux.Handle("PUT /api/programs/{id}/save", srv.applyMiddleware(http.HandlerFunc(srv.handleError(srv.handleFavoriteProgram))))
}

/*
* @Query Params:
* ?page=: page
* ?perPage=: perPage
* ?sort=: sort
* ?search=: search
* ?searchFields=: searchFields
 */
func (srv *Server) handleIndexPrograms(w http.ResponseWriter, r *http.Request, log sLog) error {
	page, perPage := srv.getPaginationInfo(r)
	search := r.URL.Query().Get("search")
	total, programs, err := srv.Db.GetProgram(page, perPage, search)
	if err != nil {
		log.add("search", search)
		return newDatabaseServiceError(err)
	}
	last := srv.calculateLast(total, perPage)
	paginationData := models.PaginationMeta{
		PerPage:     perPage,
		LastPage:    int(last),
		CurrentPage: page,
		Total:       total,
	}
	return writePaginatedResponse(w, http.StatusOK, programs, paginationData)
}

func (srv *Server) handleShowProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	program, err := srv.Db.GetProgramByID(id)
	if err != nil {
		log.add("programId", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, program)
}

func (srv *Server) handleCreateProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	var program models.Program
	err := json.NewDecoder(r.Body).Decode(&program)
	defer r.Body.Close()
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	_, err = srv.Db.CreateProgram(&program)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, "Program created successfully")
}

func (srv *Server) handleUpdateProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	program := models.Program{}
	err := json.NewDecoder(r.Body).Decode(&program)
	defer r.Body.Close()
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	log.add("programId", id)
	toUpdate, err := srv.Db.GetProgramByID(id)
	if err != nil {
		log.error("Error getting program:" + err.Error())
	}
	models.UpdateStruct(&toUpdate, &program)
	updated, updateErr := srv.Db.UpdateProgram(toUpdate)
	if updateErr != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, updated)
}

func (srv *Server) handleDeleteProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	log.add("programID", id)
	if err = srv.Db.DeleteProgram(id); err != nil {
		return newDatabaseServiceError(err)
	}
	log.info("Program deleted")
	return writeJsonResponse(w, http.StatusNoContent, "Program deleted successfully")
}

func (srv *Server) handleFavoriteProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	user_id := srv.userIdFromRequest(r)
	favoriteRemoved, err := srv.Db.ToggleUserFavorite(user_id, uint(id))
	if err != nil {
		log.add("programId", id)
		log.add("userId", user_id)
		return newDatabaseServiceError(err)
	}
	log.debugf("Favorite removed: %v", favoriteRemoved)
	if favoriteRemoved {
		w.WriteHeader(http.StatusNoContent)
		return nil
	}
	return writeJsonResponse(w, http.StatusOK, "Favorite updated successfully")
}
