package handlers

import (
	"Go-Prototype/backend/cmd/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) RegisterProviderPlatformRoutes() {
	srv.Mux.Handle("GET /api/provider-platforms", srv.ApplyMiddleware(http.HandlerFunc(srv.IndexProviders)))
	srv.Mux.Handle("GET /api/provider-platforms/{id}", srv.ApplyMiddleware(http.HandlerFunc(srv.ShowProvider)))
	srv.Mux.Handle("POST /api/provider-platforms", srv.ApplyMiddleware(http.HandlerFunc(srv.CreateProvider)))
	srv.Mux.Handle("PATCH /api/provider-platforms/{id}", srv.ApplyMiddleware(http.HandlerFunc(srv.UpdateProvider)))
	srv.Mux.Handle("DELETE /api/provider-platforms/{id}", srv.ApplyMiddleware(http.HandlerFunc(srv.DeleteProvider)))
}

func (srv *Server) IndexProviders(w http.ResponseWriter, r *http.Request) {
	srv.LogInfo("Handling provider index request")
	page, perPage := srv.GetPaginationInfo(r)
	total, platforms, err := srv.Db.GetAllProviderPlatforms(page, perPage)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	paginationData := models.NewPaginationInfo(page, perPage, total)
	response := models.PaginatedResource[models.ProviderPlatform]{
		Data: platforms,
		Meta: paginationData,
	}
	srv.LogInfo("Found " + strconv.Itoa(int(total)) + " provider platforms")
	if err = srv.WriteResponse(w, http.StatusOK, response); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (srv *Server) ShowProvider(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.LogError("GET Provider handler Error: " + err.Error())
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	platform, err := srv.Db.GetProviderPlatformByID(id)
	if err != nil {
		srv.LogError("Error: " + err.Error())
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err = srv.WriteResponse(w, http.StatusOK, platform); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (srv *Server) CreateProvider(w http.ResponseWriter, r *http.Request) {
	var platform models.ProviderPlatform
	err := json.NewDecoder(r.Body).Decode(&platform)
	if err != nil {
		srv.LogError("Error decoding request body: " + err.Error())
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	if err = srv.Db.CreateProviderPlatform(platform); err != nil {
		srv.LogError("Error creating provider platform: " + err.Error())
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
	if err = srv.WriteResponse(w, http.StatusOK, platform); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (srv *Server) UpdateProvider(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.LogError("PATCH Provider handler Error:" + err.Error())
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	var platform models.ProviderPlatform
	err = json.NewDecoder(r.Body).Decode(&platform)
	if err != nil {
		srv.LogError("Error decoding request body: " + err.Error())
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	if err = srv.Db.UpdateProviderPlatform(platform, id); err != nil {
		srv.LogError("Error updating provider platform: " + err.Error())
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
	if err = srv.WriteResponse(w, http.StatusOK, platform); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (srv *Server) DeleteProvider(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.LogError("DELETE Provider handler Error: " + err.Error())
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	if err = srv.Db.DeleteProviderPlatform(id); err != nil {
		srv.LogError("Error deleting provider platform: " + err.Error())
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
	w.WriteHeader(http.StatusNoContent)
}
