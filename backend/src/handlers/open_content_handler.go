package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

func (srv *Server) registerOpenContentRoutes() {
	srv.Mux.Handle("GET /api/open-content", srv.applyMiddleware(srv.handleIndexOpenContent))
	srv.Mux.Handle("PUT /api/open-content/{id}", srv.applyAdminMiddleware(srv.handleToggleOpenContent))
	srv.Mux.Handle("PATCH /api/open-content/{id}", srv.applyAdminMiddleware(srv.handleUpdateOpenContentProvider))
	srv.Mux.Handle("POST /api/open-content", srv.applyAdminMiddleware(srv.handleCreateOpenContent))
}

func (srv *Server) handleIndexOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	only := r.URL.Query().Get("all")
	var all bool
	if strings.ToLower(strings.TrimSpace(only)) == "true" {
		all = true
	}
	content, err := srv.Db.GetOpenContent(all)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, content)
}

func (srv *Server) handleUpdateOpenContentProvider(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "open content provider ID")
	}
	log.add("open_content_provider_id", id)
	var body models.OpenContentProvider
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()
	var prov models.OpenContentProvider
	if err := srv.Db.Find(&prov, id).Error; err != nil {
		return newDatabaseServiceError(err)
	}
	models.UpdateStruct(&prov, &body)
	if err := srv.Db.UpdateOpenContentProvider(&prov); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Content provider updated successfully")
}

func (srv *Server) handleToggleOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "open content provider ID")
	}
	if err := srv.Db.ToggleContentProvider(id); err != nil {
		log.add("openContentProviderId", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Content provider toggled successfully")
}

func (srv *Server) handleCreateOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	var body models.OpenContentProvider
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()
	if err := srv.Db.CreateContentProvider(&body); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, "Content provider created successfully")
}
