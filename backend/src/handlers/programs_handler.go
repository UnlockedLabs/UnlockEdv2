package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerProgramsRoutes() {
	srv.Mux.Handle("GET /api/programs", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleError(srv.HandleIndexPrograms))))
	srv.Mux.Handle("GET /api/programs/{id}", srv.applyMiddleware(http.HandlerFunc(srv.HandleError(srv.HandleShowProgram))))
	srv.Mux.Handle("POST /api/programs", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleError(srv.HandleCreateProgram))))
	srv.Mux.Handle("DELETE /api/programs/{id}", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleError(srv.HandleDeleteProgram))))
	srv.Mux.Handle("PATCH /api/programs/{id}", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleError(srv.HandleUpdateProgram))))
	srv.Mux.Handle("PUT /api/programs/{id}/save", srv.applyMiddleware(http.HandlerFunc(srv.HandleError(srv.HandleFavoriteProgram))))
}

/*
* @Query Params:
* ?page=: page
* ?perPage=: perPage
* ?sort=: sort
* ?search=: search
* ?searchFields=: searchFields
 */
func (srv *Server) HandleIndexPrograms(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleIndexPrograms")
	page, perPage := srv.GetPaginationInfo(r)
	search := r.URL.Query().Get("search")
	total, programs, err := srv.Db.GetProgram(page, perPage, search)
	if err != nil {
		fields.add("search", search)
		return newDatabaseServiceError(err)
	}
	last := srv.CalculateLast(total, perPage)
	paginationData := models.PaginationMeta{
		PerPage:     perPage,
		LastPage:    int(last),
		CurrentPage: page,
		Total:       total,
	}
	return writePaginatedResponse(w, http.StatusOK, programs, paginationData)
}

func (srv *Server) HandleShowProgram(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleShowProgram")
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	program, err := srv.Db.GetProgramByID(id)
	if err != nil {
		fields.add("programId", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, program)
}

func (srv *Server) HandleCreateProgram(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleCreateProgram")
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

func (srv *Server) HandleUpdateProgram(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleUpdateProgram")
	var program models.Program
	err := json.NewDecoder(r.Body).Decode(&program)
	defer r.Body.Close()
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	fields.add("programId", id)
	toUpdate, err := srv.Db.GetProgramByID(id)
	if err != nil {
		fields.error("Error getting program:" + err.Error())
	}
	models.UpdateStruct(&toUpdate, &program)
	updated, updateErr := srv.Db.UpdateProgram(toUpdate)
	if updateErr != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, updated)
}

func (srv *Server) HandleDeleteProgram(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleDeleteProgram")
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	fields.add("programID", id)
	if err = srv.Db.DeleteProgram(id); err != nil {
		return newDatabaseServiceError(err)
	}
	fields.info("Program deleted")
	return writeJsonResponse(w, http.StatusNoContent, "Program deleted successfully")
}

func (srv *Server) HandleFavoriteProgram(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleFavoriteProgram")
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	user_id := srv.GetUserID(r)
	favoriteRemoved, err := srv.Db.ToggleUserFavorite(user_id, uint(id))
	if err != nil {
		fields.add("programId", id)
		fields.add("user_id", user_id)
		return newDatabaseServiceError(err)
	}
	if favoriteRemoved {
		w.WriteHeader(http.StatusNoContent)
		return nil
	}
	return writeJsonResponse(w, http.StatusOK, "Favorite updated successfully")
}
