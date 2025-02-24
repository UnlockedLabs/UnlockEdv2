package handlers

import (
	"UnlockEdv2/src/models"
	"net/http"
)

func (srv *Server) registerTagRoutes() []routeDef {
	axx := models.Feature(models.OpenContentAccess)
	return []routeDef{
		{"GET /api/tags", srv.handleGetTags, false, axx},
	}
}

func (srv *Server) handleGetTags(w http.ResponseWriter, r *http.Request, log sLog) error {
	categories, err := srv.Db.GetTags()
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, categories)
}
