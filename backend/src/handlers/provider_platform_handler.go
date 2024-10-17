package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"slices"
	"strconv"
)

func (srv *Server) registerProviderPlatformRoutes() {
	srv.Mux.Handle("GET /api/provider-platforms", srv.applyAdminMiddleware(srv.handleIndexProviders))
	srv.Mux.Handle("GET /api/provider-platforms/{id}", srv.applyAdminMiddleware(srv.handleShowProvider))
	srv.Mux.Handle("POST /api/provider-platforms", srv.applyAdminMiddleware(srv.handleCreateProvider))
	srv.Mux.Handle("PATCH /api/provider-platforms/{id}", srv.applyAdminMiddleware(srv.handleUpdateProvider))
	srv.Mux.Handle("DELETE /api/provider-platforms/{id}", srv.applyAdminMiddleware(srv.handleDeleteProvider))
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
	}
	slices.SortFunc(platforms, func(i, j models.ProviderPlatform) int {
		if i.State == models.Enabled && j.State != models.Enabled {
			return -1
		} else if i.State != models.Enabled && j.State == models.Enabled {
			return 1
		} else if i.State == models.Archived && j.State != models.Archived {
			return 1
		} else if i.State != models.Archived && j.State == models.Archived {
			return -1
		} else {
			return 0
		}
	})

	log.info("Found "+strconv.Itoa(int(total)), " provider platforms")
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
	err = srv.Db.CreateProviderPlatform(&platform)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, platform)
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
	return writeJsonResponse(w, http.StatusNoContent, "Provider platform deleted successfully")
}
