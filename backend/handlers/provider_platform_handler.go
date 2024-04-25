package handlers

import (
	"backend/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) IndexProviders(w http.ResponseWriter, r *http.Request) {
	srv.Logger.Println("Handling provider index request")
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
	srv.Logger.Printf("Found %d provider platforms", total)
	if err = srv.WriteResponse(w, http.StatusOK, response); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (srv *Server) ShowProvider(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.Logger.Printf("GET Provider handler Error: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	platform, err := srv.Db.GetProviderPlatformByID(id)
	if err != nil {
		srv.Logger.Printf("Error: %v", err)
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
		srv.Logger.Printf("Error decoding request body: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	if err = srv.Db.CreateProviderPlatform(platform); err != nil {
		srv.Logger.Printf("Error creating provider platform: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
	if err = srv.WriteResponse(w, http.StatusOK, platform); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (srv *Server) UpdateProvider(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.Logger.Printf("PATCH Provider handler Error: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	var platform models.ProviderPlatform
	err = json.NewDecoder(r.Body).Decode(&platform)
	if err != nil {
		srv.Logger.Printf("Error decoding request body: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	if err = srv.Db.UpdateProviderPlatform(platform, id); err != nil {
		srv.Logger.Printf("Error updating provider platform: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
	if err = srv.WriteResponse(w, http.StatusOK, platform); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (srv *Server) DeleteProvider(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.Logger.Printf("DELETE Provider handler Error: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	if err = srv.Db.DeleteProviderPlatform(id); err != nil {
		srv.Logger.Printf("Error deleting provider platform: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
	w.WriteHeader(http.StatusNoContent)
}
