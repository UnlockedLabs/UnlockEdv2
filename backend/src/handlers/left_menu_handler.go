package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerLeftMenuRoutes() {
	srv.Mux.Handle("GET /api/left-menu", srv.applyMiddleware(http.HandlerFunc(srv.handleGetLeftMenu)))
	srv.Mux.Handle("PUT /api/left-menu", srv.applyAdminMiddleware(http.HandlerFunc(srv.handlePostLeftMenuLinks)))
}

func (srv *Server) handleGetLeftMenu(w http.ResponseWriter, r *http.Request) {
	log.Info("GET: /api/left-menu")
	logFields := log.Fields{
		"handler": "handleGetLeftMenu",
		"route":   "GET /api/left-menu",
	}
	links, err := srv.Db.GetLeftMenuLinks()
	if err != nil {
		logFields["databaseMethod"] = "GetLeftMenuLinks"
		log.WithFields(logFields).Errorf("Error getting left menu links: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	response := models.Resource[models.LeftMenuLink]{
		Data: links,
	}
	if err = srv.WriteResponse(w, http.StatusOK, response); err != nil {
		log.WithFields(logFields).Errorf("Error writing response when fetching left menu: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

func (srv *Server) handlePostLeftMenuLinks(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "handlePostLeftMenuLinks",
		"route":   "PUT /api/left-menu",
	}
	var links []models.LeftMenuLink
	err := json.NewDecoder(r.Body).Decode(&links)
	if err != nil {
		log.WithFields(logFields).Errorf("Error decoding left menu links: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err = srv.Db.DeleteAllLinks(); err != nil {
		logFields["databaseMethod"] = "DeleteAllLinks"
		log.WithFields(logFields).Errorf("Error deleting left menu links: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err = srv.Db.CreateFreshLeftMenuLinks(links); err != nil {
		logFields["databaseMethod"] = "CreateFreshLeftMenuLinks"
		log.WithFields(logFields).Errorf("Error refreshing left menu links: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}
