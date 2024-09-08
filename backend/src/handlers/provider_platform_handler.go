package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerProviderPlatformRoutes() {
	srv.Mux.HandleFunc("GET /api/provider-platforms", srv.ApplyAdminMiddleware(srv.HandleIndexProviders))
	srv.Mux.HandleFunc("GET /api/provider-platforms/{id}", srv.ApplyAdminMiddleware(srv.HandleShowProvider))
	srv.Mux.HandleFunc("POST /api/provider-platforms", srv.ApplyAdminMiddleware(srv.HandleCreateProvider))
	srv.Mux.HandleFunc("PATCH /api/provider-platforms/{id}", srv.ApplyAdminMiddleware(srv.HandleUpdateProvider))
	srv.Mux.HandleFunc("DELETE /api/provider-platforms/{id}", srv.ApplyAdminMiddleware(srv.HandleDeleteProvider))
}

func (srv *Server) HandleIndexProviders(w http.ResponseWriter, r *http.Request) {
	page, perPage := srv.GetPaginationInfo(r)
	total, platforms, err := srv.Db.GetAllProviderPlatforms(page, perPage)
	if err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, "Error fetching provider platforms from database")
		return
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
	writePaginatedResponse(w, http.StatusOK, platformsResp, paginationData)
}

func (srv *Server) HandleShowProvider(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Error("GET Provider handler Error: ", err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, "Error decoding ID from path")
	}
	platform, err := srv.Db.GetProviderPlatformByID(id)
	if err != nil {
		log.Error("Error: ", err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, "Error fetching provider platform from database")
		return
	}
	writeJsonResponse(w, http.StatusOK, *platform)
}

func (srv *Server) HandleCreateProvider(w http.ResponseWriter, r *http.Request) {
	var platform models.ProviderPlatform
	err := json.NewDecoder(r.Body).Decode(&platform)
	if err != nil {
		log.Error("Error decoding request body: ", err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, "Error decoding request form body")
		return
	}
	defer r.Body.Close()
	newProv, err := srv.Db.CreateProviderPlatform(&platform)
	if err != nil {
		log.Error("Error creating provider platform: ", err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, "Error creating provider with provided form data")
		return
	}
	writeJsonResponse(w, http.StatusCreated, newProv)
}

func (srv *Server) HandleUpdateProvider(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Error("PATCH Provider handler Error:", err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, "Error decoding provided form data")
		return
	}
	var platform models.ProviderPlatform
	err = json.NewDecoder(r.Body).Decode(&platform)
	if err != nil {
		log.Error("Error decoding request body: ", err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, "Error decoding provided form data")
		return
	}
	defer r.Body.Close()
	updated, err := srv.Db.UpdateProviderPlatform(&platform, uint(id))
	if err != nil {
		log.Error("Error updating provider platform: ", err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, "Error updating provider with provided form data")
		return
	}
	writeJsonResponse(w, http.StatusOK, *updated)
}

func (srv *Server) HandleDeleteProvider(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Error("DELETE Provider handler Error: ", err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, "invalid id provided in path")
		return
	}
	if err = srv.Db.DeleteProviderPlatform(id); err != nil {
		log.Error("Error deleting provider platform: ", err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, "Error deleting provider platform")
		return
	}
	writeJsonResponse(w, http.StatusOK, "Provider platform deleted successfully")
}
