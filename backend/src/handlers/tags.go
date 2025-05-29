package handlers

import (
	"net/http"
)

func (srv *Server) registerTagRoutes() []routeDef {
	return []routeDef{
		newRoute("GET /api/tags", srv.handleGetTags),
	}
}

func (srv *Server) handleGetTags(w http.ResponseWriter, r *http.Request, log sLog) error {
	categories, err := srv.Db.GetTags()
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, categories)
}
