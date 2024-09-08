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
	writeJsonResponse(w, http.StatusOK, links)
}

func (srv *Server) handlePostLeftMenuLinks(w http.ResponseWriter, r *http.Request) {
	var links []models.LeftMenuLink
	err := json.NewDecoder(r.Body).Decode(&links)
	if err != nil {
		log.Error("PostLeftMenuLinks Error:" + err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, "Error decoding request form")
		return
	}
	if err = srv.Db.DeleteAllLinks(); err != nil {
		log.Error("PostLeftMenuLinks Error:" + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, "Error deleting links in database")
		return
	}
	if err = srv.Db.CreateFreshLeftMenuLinks(links); err != nil {
		log.Error("PostLeftMenuLinks Error:" + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, "Error creating links in database")
		return
	}
	writeJsonResponse(w, http.StatusCreated, links)
}
