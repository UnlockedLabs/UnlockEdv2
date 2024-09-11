package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerProviderPlatformRoutes() {
	srv.Mux.HandleFunc("GET /api/provider-platforms", srv.ApplyAdminMiddleware(srv.HandleError(srv.HandleIndexProviders)))
	srv.Mux.HandleFunc("GET /api/provider-platforms/{id}", srv.ApplyAdminMiddleware(srv.HandleError(srv.HandleShowProvider)))
	srv.Mux.HandleFunc("POST /api/provider-platforms", srv.ApplyAdminMiddleware(srv.HandleError(srv.HandleCreateProvider)))
	srv.Mux.HandleFunc("PATCH /api/provider-platforms/{id}", srv.ApplyAdminMiddleware(srv.HandleError(srv.HandleUpdateProvider)))
	srv.Mux.HandleFunc("DELETE /api/provider-platforms/{id}", srv.ApplyAdminMiddleware(srv.HandleError(srv.HandleDeleteProvider)))
}

func (srv *Server) HandleIndexProviders(w http.ResponseWriter, r *http.Request) error {
	page, perPage := srv.GetPaginationInfo(r)
	total, platforms, err := srv.Db.GetAllProviderPlatforms(page, perPage)
	if err != nil {
		return newDatabaseServiceError(err, nil)
	}
	paginationData := models.NewPaginationInfo(page, perPage, total)
	platformsResp := make([]models.ProviderPlatform, 0)
	only := r.URL.Query().Get("only")
	if only == "oidc_enabled" {
		for _, platform := range platforms {
			if platform.OidcID != 0 {
				platformsResp = append(platformsResp, platform)
			}
		}
	} else {
		platformsResp = platforms
	}
	log.Info("Found "+strconv.Itoa(int(total)), " provider platforms")
	return writePaginatedResponse(w, http.StatusOK, platformsResp, paginationData)
}

func (srv *Server) HandleShowProvider(w http.ResponseWriter, r *http.Request) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "provider platform ID", nil)
	}
	platform, err := srv.Db.GetProviderPlatformByID(id)
	if err != nil {
		return newDatabaseServiceError(err, nil)
	}
	return writeJsonResponse(w, http.StatusOK, *platform)
}

func (srv *Server) HandleCreateProvider(w http.ResponseWriter, r *http.Request) error {
	var platform models.ProviderPlatform
	err := json.NewDecoder(r.Body).Decode(&platform)
	if err != nil {
		return newJSONReqBodyServiceError(err, nil)
	}
	defer r.Body.Close()
	newProv, err := srv.Db.CreateProviderPlatform(&platform)
	if err != nil {
		return newDatabaseServiceError(err, nil)
	}
	return writeJsonResponse(w, http.StatusCreated, newProv)
}

func (srv *Server) HandleUpdateProvider(w http.ResponseWriter, r *http.Request) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "provider platform ID", nil)
	}
	var platform models.ProviderPlatform
	err = json.NewDecoder(r.Body).Decode(&platform)
	if err != nil {
		return newJSONReqBodyServiceError(err, nil)
	}
	defer r.Body.Close()
	updated, err := srv.Db.UpdateProviderPlatform(&platform, uint(id))
	if err != nil {
		return newDatabaseServiceError(err, nil)
	}
	return writeJsonResponse(w, http.StatusOK, *updated)
}

func (srv *Server) HandleDeleteProvider(w http.ResponseWriter, r *http.Request) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "provider platform ID", nil)
	}
	if err = srv.Db.DeleteProviderPlatform(id); err != nil {
		return newDatabaseServiceError(err, nil)
	}
	return writeJsonResponse(w, http.StatusOK, "Provider platform deleted successfully")
}
