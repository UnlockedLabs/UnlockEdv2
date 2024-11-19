package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
)

func (srv *Server) registerLeftMenuRoutes() []routeDef {
	axx := models.Feature()
	return []routeDef{
		{"GET /api/left-menu", srv.handleGetLeftMenu, false, axx},
		{"PUT /api/left-menu", srv.handlePostLeftMenuLinks, true, axx},
	}
}

func (srv *Server) handleGetLeftMenu(w http.ResponseWriter, r *http.Request, log sLog) error {
	log.info("GET: /api/left-menu")
	links, err := srv.Db.GetLeftMenuLinks()
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, links)
}

func (srv *Server) handlePostLeftMenuLinks(w http.ResponseWriter, r *http.Request, log sLog) error {
	var links []models.LeftMenuLink
	err := json.NewDecoder(r.Body).Decode(&links)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	if err = srv.Db.DeleteAllLinks(); err != nil {
		return newDatabaseServiceError(err)
	}
	if err = srv.Db.CreateFreshLeftMenuLinks(links); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, links)
}
