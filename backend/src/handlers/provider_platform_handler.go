package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"slices"
	"strconv"
)

func (srv *Server) registerProviderPlatformRoutes() {
	srv.Mux.HandleFunc("GET /api/provider-platforms", srv.applyAdminMiddleware(srv.handleError(srv.handleIndexProviders)))
	srv.Mux.HandleFunc("GET /api/provider-platforms/{id}", srv.applyAdminMiddleware(srv.handleError(srv.handleShowProvider)))
	srv.Mux.HandleFunc("POST /api/provider-platforms", srv.applyAdminMiddleware(srv.handleError(srv.handleCreateProvider)))
	srv.Mux.HandleFunc("PATCH /api/provider-platforms/{id}", srv.applyAdminMiddleware(srv.handleError(srv.handleUpdateProvider)))
	srv.Mux.HandleFunc("DELETE /api/provider-platforms/{id}", srv.applyAdminMiddleware(srv.handleError(srv.handleDeleteProvider)))
}

func (srv *Server) handleIndexProviders(w http.ResponseWriter, r *http.Request, log sLog) error {
	page, perPage := srv.getPaginationInfo(r)
	total, platforms, err := srv.Db.GetAllProviderPlatforms(page, perPage)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	paginationData := models.NewPaginationInfo(page, perPage, total)
	only := r.URL.Query().Get("only")
	if only == "oidc_enabled" {
		// this is for offering user creation in enabled providers
		platforms = slices.DeleteFunc(platforms, func(platform models.ProviderPlatform) bool {
			// don't return kolibri, as users are automatically created in kolibri
			return platform.OidcID == 0 || platform.Type == models.Kolibri
		})
		paginationData.Total = int64(len(platforms)) //need to reset total to this length
	}
	log.info("Found "+strconv.Itoa(int(paginationData.Total)), " provider platforms")
	return writePaginatedResponse(w, http.StatusOK, platforms, paginationData)
}

func (srv *Server) handleShowProvider(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "provider platform ID")
	}
	log.add("providerPlatformID", id)
	platform, err := srv.Db.GetProviderPlatformByID(id)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, *platform)
}

func (srv *Server) handleCreateProvider(w http.ResponseWriter, r *http.Request, log sLog) error {
	var platform models.ProviderPlatform
	err := json.NewDecoder(r.Body).Decode(&platform)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()
	newProv, err := srv.Db.CreateProviderPlatform(&platform)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, newProv)
}

func (srv *Server) handleUpdateProvider(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "provider platform ID")
	}
	log.add("providerPlatformId", id)
	var platform models.ProviderPlatform
	err = json.NewDecoder(r.Body).Decode(&platform)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()
	updated, err := srv.Db.UpdateProviderPlatform(&platform, uint(id))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, *updated)
}

func (srv *Server) handleDeleteProvider(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "provider platform ID")
	}
	log.add("providerPlatformId", id)
	if err = srv.Db.DeleteProviderPlatform(id); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Provider platform deleted successfully")
}
