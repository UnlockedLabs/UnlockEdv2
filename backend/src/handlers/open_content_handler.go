package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

func (srv *Server) registerOpenContentRoutes() {
	srv.Mux.Handle("GET /api/open-content", srv.applyMiddleware(srv.handleError(srv.handleIndexOpenContent)))
	srv.Mux.Handle("PUT /api/open-content/{id}", srv.applyAdminMiddleware(srv.handleError(srv.handleToggleOpenContent)))
	srv.Mux.Handle("POST /api/open-content", srv.applyAdminMiddleware(srv.handleError(srv.handleCreateOpenContent)))
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

type NewContentRequest struct {
	Url          string `json:"url"`
	ThumbnailUrl string `json:"thumbnail_url"`
	LinkedID     int    `json:"linked_provider_id"`
	Description  string `json:"description"`
}

func (srv *Server) handleCreateOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	var body NewContentRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()
	if err := srv.Db.CreateContentProvider(body.Url, body.ThumbnailUrl, body.Description, body.LinkedID); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, "Content provider created successfully")
}
