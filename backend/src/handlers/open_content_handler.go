package handlers

import (
	"UnlockEdv2/src/models"
	"net/http"
	"strings"
)

func (srv *Server) registerOpenContentRoutes() []routeDef {
	axx := models.Feature(models.OpenContentAccess)
	return []routeDef{
		{"GET /api/open-content/favorites", srv.handleGetUserFavoriteOpenContent, false, axx},
		{"GET /api/open-content", srv.handleIndexOpenContent, false, axx},
	}
}

func (srv *Server) handleIndexOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	only := r.URL.Query().Get("all")
	var all bool
	if userIsAdmin(r) && strings.ToLower(strings.TrimSpace(only)) == "true" {
		all = true
	}
	content, err := srv.Db.GetOpenContent(all)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, content)
}

func (srv *Server) handleGetUserFavoriteOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	page, perPage := srv.getPaginationInfo(r)
	total, favorites, err := srv.Db.GetUserFavorites(srv.getUserID(r), page, perPage)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	meta := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, favorites, meta)
}
