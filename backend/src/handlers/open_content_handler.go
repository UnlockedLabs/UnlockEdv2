package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerOpenContentRoutes() {
	srv.Mux.Handle("GET /api/open-content", srv.applyMiddleware(srv.IndexOpenContent))
	srv.Mux.Handle("PUT /api/open-content/{id}", srv.ApplyAdminMiddleware(srv.ToggleOpenContent))
	srv.Mux.Handle("POST /api/open-content", srv.ApplyAdminMiddleware(srv.CreateOpenContent))
}

func (srv *Server) IndexOpenContent(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "IndexOpenContent"}
	only := r.URL.Query().Get("all")
	var all bool
	if strings.ToLower(strings.TrimSpace(only)) == "true" {
		all = true
	}
	content, err := srv.Db.GetOpenContent(all)
	if err != nil {
		log.WithFields(fields).Errorln("unable to fetch open content from DB")
		srv.ErrorResponse(w, http.StatusInternalServerError, "Unable to fetch records from DB")
		return
	}
	srv.WriteResponse(w, http.StatusOK, models.DefaultResource(content))
}

func (srv *Server) ToggleOpenContent(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "ToggleOpenContent"}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.WithFields(fields).Errorln("unable to parse ID from path")
		srv.ErrorResponse(w, http.StatusBadRequest, "unable to parse ID from path")
		return
	}
	if err := srv.Db.ToggleContentProvider(id); err != nil {
		log.WithFields(fields).Errorln("unable to find or toggle content provider, please make sure id is correct")
		srv.ErrorResponse(w, http.StatusInternalServerError, "Unable to find records from DB")
		return
	}
	w.WriteHeader(http.StatusOK)
}

type NewContentRequest struct {
	Url          string `json:"url"`
	ThumbnailUrl string `json:"thumbnail_url"`
	LinkedID     int    `json:"linked_provider_id"`
	Description  string `json:"description"`
}

func (srv *Server) CreateOpenContent(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "CreateOpenContent"}
	var body NewContentRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		log.WithFields(fields).Errorln("unable to decode request body")
		srv.ErrorResponse(w, http.StatusBadRequest, "unable to decode request body")
		return
	}
	defer r.Body.Close()
	if err := srv.Db.CreateContentProvider(body.Url, body.ThumbnailUrl, body.Description, body.LinkedID); err != nil {
		log.WithFields(fields).Errorln("unable to find or toggle content provider, please make sure id is correct")
		srv.ErrorResponse(w, http.StatusInternalServerError, "Unable to find records from DB")
		return
	}
	w.WriteHeader(http.StatusCreated)
}
