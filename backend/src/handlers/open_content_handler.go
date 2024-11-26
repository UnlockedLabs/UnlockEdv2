package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

func (srv *Server) registerOpenContentRoutes() []routeDef {
	axx := models.Feature(models.OpenContentAccess)
	return []routeDef{
		{"GET /api/open-content", srv.handleIndexOpenContent, false, axx},
		{"PUT /api/open-content/{id}", srv.handleToggleOpenContent, true, axx},
		{"PATCH /api/open-content/{id}", srv.handleUpdateOpenContentProvider, true, axx},
		{"POST /api/open-content", srv.handleCreateOpenContent, true, axx},
		{"PUT /api/open-content/{id}/save", srv.handleToggleFavoriteOpenContent, false, axx},
		{"GET /api/open-content/favorites", srv.handleGetUserFavoriteOpenContent, false, axx},
		{"PUT /api/open-content/{id}/feature", srv.handleToggleFeatureLibrary, true, axx},
		{"GET /api/open-content/featured", srv.handleGetFacilityFeaturedOpenContent, false, axx},
	}
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

func (srv *Server) handleUpdateOpenContentProvider(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "open content provider ID")
	}
	log.add("open_content_provider_id", id)
	var body models.OpenContentProvider
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()
	var prov models.OpenContentProvider
	if err := srv.Db.Find(&prov, id).Error; err != nil {
		return newDatabaseServiceError(err)
	}
	models.UpdateStruct(&prov, &body)
	if err := srv.Db.UpdateOpenContentProvider(&prov); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Content provider updated successfully")
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

func (srv *Server) handleCreateOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	var body models.OpenContentProvider
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()
	if err := srv.Db.CreateContentProvider(&body); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, "Content provider created successfully")
}

func (srv *Server) handleToggleFavoriteOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	var reqBody models.OpenContentParams
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()

	contentID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInternalServerServiceError(err, "error converting content id to int")
	}
	reqBody.UserID = srv.userIdFromRequest(r)
	reqBody.ContentID = uint(contentID)
	if _, err := srv.Db.ToggleLibraryFavorite(&reqBody); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Favorite toggled successfully")
}

func (srv *Server) handleGetUserFavoriteOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	page, perPage := srv.getPaginationInfo(r)
	total, favorites, err := srv.Db.GetUserFavorites(srv.userIdFromRequest(r), page, perPage)
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

	reqBody.UserID = srv.userIdFromRequest(r)
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
