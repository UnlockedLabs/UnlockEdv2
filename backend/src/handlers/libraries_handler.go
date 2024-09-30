package handlers

import (
	"UnlockEdv2/src/models"
	"net/http"
	"strconv"
)

func (srv *Server) registerLibraryRoutes() {
	srv.Mux.Handle("GET /api/libraries", srv.applyAdminMiddleware(srv.handleIndexLibraries))
	srv.Mux.Handle("GET /api/libraries/visible", srv.applyMiddleware(srv.handleIndexVisibleLibraries))
	srv.Mux.Handle("PUT /api/libraries/{id}", srv.applyAdminMiddleware(srv.handleToggleLibraryVisibility))
}

func (srv *Server) handleIndexLibraries(w http.ResponseWriter, r *http.Request, log sLog) error {
	page, perPage := srv.getPaginationInfo(r)
	search := r.URL.Query().Get("search")
	var providerId int
	providerIdStr := r.URL.Query().Get("providerId")
	if providerIdStr != "" {
		var err error
		providerId, err = strconv.Atoi(providerIdStr)
		if err != nil {
			return newInvalidQueryParamServiceError(err, "Open content provider ID")
		}
	}
	var showHidden bool
	showHiddenStr := r.URL.Query().Get("showHidden")
	if showHiddenStr != "" {
		var err error
		showHidden, err = strconv.ParseBool(showHiddenStr)
		if err != nil {
			return newInvalidQueryParamServiceError(err, "show hidden")
		}
	}
	total, libraries, err := srv.Db.GetAllLibraries(page, perPage, showHidden, search, providerId)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	paginationData := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, libraries, paginationData)
}

func (srv *Server) handleIndexVisibleLibraries(w http.ResponseWriter, r *http.Request, log sLog) error {
	page, perPage := srv.getPaginationInfo(r)
	search := r.URL.Query().Get("search")
	var providerId int
	providerIdStr := r.URL.Query().Get("providerId")
	if providerIdStr != "" {
		var err error
		providerId, err = strconv.Atoi(providerIdStr)
		if err != nil {
			return newInvalidQueryParamServiceError(err, "Open content provider ID")
		}
	}
	total, libraries, err := srv.Db.GetAllLibraries(page, perPage, false, search, providerId)
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
		log.add("libraryId", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Library visibility updated successfully")
}
