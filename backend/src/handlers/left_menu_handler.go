package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerLeftMenuRoutes() {
	srv.Mux.Handle("GET /api/left-menu", srv.applyMiddleware(http.HandlerFunc(srv.handleGetLeftMenu)))
	srv.Mux.Handle("PUT /api/left-menu", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.handlePostLeftMenuLinks)))
}

func (srv *Server) handleGetLeftMenu(w http.ResponseWriter, r *http.Request) {
	log.Info("GET: /api/left-menu")
	links, err := srv.Db.GetLeftMenuLinks()
	if err != nil {
		log.Debug("GetLeftMenu Database Error: ", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	response := models.Resource[models.LeftMenuLink]{
		Data: links,
	}
	if err = srv.WriteResponse(w, http.StatusOK, response); err != nil {
		log.Error("Error writing response: " + err.Error())
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

func (srv *Server) handlePostLeftMenuLinks(w http.ResponseWriter, r *http.Request) {
	var links []models.LeftMenuLink
	err := json.NewDecoder(r.Body).Decode(&links)
	if err != nil {
		log.Error("PostLeftMenuLinks Error:" + err.Error())
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err = srv.Db.DeleteAllLinks(); err != nil {
		log.Error("PostLeftMenuLinks Error:" + err.Error())
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err = srv.Db.CreateFreshLeftMenuLinks(links); err != nil {
		log.Error("PostLeftMenuLinks Error:" + err.Error())
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}
