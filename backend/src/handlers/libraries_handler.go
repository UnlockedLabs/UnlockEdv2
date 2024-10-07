package handlers

import (
	"UnlockEdv2/src/models"
	"net/http"
	"strconv"
)

func (srv *Server) registerLibraryRoutes() {
	srv.Mux.Handle("GET /api/libraries", srv.applyMiddleware(srv.handleIndexLibraries))
	srv.Mux.Handle("PUT /api/libraries/{id}", srv.applyAdminMiddleware(srv.handleToggleLibraryVisibility))
}

func (srv *Server) handleIndexLibraries(w http.ResponseWriter, r *http.Request, log sLog) error {
	page, perPage := srv.getPaginationInfo(r)
	search := r.URL.Query().Get("search")
	providerId, err := strconv.Atoi(r.URL.Query().Get("provider_id"))
	if err != nil {
		providerId = 0
	}
	showHidden := "visible"
	if !srv.UserIsAdmin(r) && r.URL.Query().Get("visibility") == "hidden" {
		return newUnauthorizedServiceError()
	}
	if srv.UserIsAdmin(r) {
		showHidden = r.URL.Query().Get("visibility")
	}
	total, libraries, err := srv.Db.GetAllLibraries(page, perPage, showHidden, search, providerId)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	paginationData := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, libraries, paginationData)
}

func (srv *Server) handleToggleLibraryVisibility(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "library id")
	}
	if err := srv.Db.ToggleLibraryVisibility(id); err != nil {
		log.add("library_id", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Library visibility updated successfully")
}
