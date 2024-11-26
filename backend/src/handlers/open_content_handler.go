package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerOpenContentRoutes() []routeDef {
	axx := models.Feature(models.OpenContentAccess)
	return []routeDef{
		{"GET /api/open-content/favorites", srv.handleGetUserFavoriteOpenContent, false, axx},
		{"PUT /api/open-content/{id}/feature", srv.handleToggleFeatureLibrary, true, axx},
		{"GET /api/open-content/featured", srv.handleGetFacilityFeaturedOpenContent, false, axx},
	}
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

func (srv *Server) handleToggleFeatureLibrary(w http.ResponseWriter, r *http.Request, log sLog) error {
	contentID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInternalServerServiceError(err, "error converting content id to int")
	}
	var reqBody models.OpenContentParams
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()

	reqBody.UserID = srv.getUserID(r)
	reqBody.ContentID = uint(contentID)
	reqBody.FacilityID = srv.getFacilityID(r)
	if err := srv.Db.ToggleFeaturedLibrary(&reqBody); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Featured content toggled successfully")
}

func (srv *Server) handleGetFacilityFeaturedOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	facilityID := srv.getFacilityID(r)
	page, perPage := srv.getPaginationInfo(r)
	total, favorites, err := srv.Db.GetFacilityFeaturedOpenContent(facilityID, page, perPage)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	meta := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, favorites, meta)
}
