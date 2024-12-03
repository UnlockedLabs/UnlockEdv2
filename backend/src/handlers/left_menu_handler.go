package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerLeftMenuRoutes() []routeDef {
	axx := models.Feature()
	return []routeDef{
		{"GET /api/helpful-links", srv.handleGetHelpfulLinks, false, axx},
		{"PUT /api/helpful-links", srv.handleAddHelpfulLink, true, axx},
		{"PATCH /api/helpful-links/{id}/edit", srv.handleEditLink, true, axx},
		{"PUT /api/helpful-links/toggle/{id}", srv.handleToggleVisibilityStatus, true, axx},
		{"DELETE /api/helpful-links/{id}", srv.handleDeleteLink, true, axx},
	}
}

func (srv *Server) handleGetHelpfulLinks(w http.ResponseWriter, r *http.Request, log sLog) error {
	search := r.URL.Query().Get("search")
	orderBy := r.URL.Query().Get("order_by")
	page, perPage := srv.getPaginationInfo(r)
	total, links, err := srv.Db.GetHelpfulLinks(page, perPage, search, orderBy)
	if err != nil {
		return newInternalServerServiceError(err, "error fetching helpful links")
	}
	meta := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, links, meta)
}

func (srv *Server) handleAddHelpfulLink(w http.ResponseWriter, r *http.Request, log sLog) error {
	var link models.HelpfulLink
	err := json.NewDecoder(r.Body).Decode(&link)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()
	facilityID := srv.getFacilityID(r)
	link.FacilityID = facilityID
	if err := srv.Db.AddHelpfulLink(link); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, "Link added successfully")
}

func (srv *Server) handleEditLink(w http.ResponseWriter, r *http.Request, log sLog) error {
	var link models.HelpfulLink
	err := json.NewDecoder(r.Body).Decode(&link)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "Invalid id")
	}
	defer r.Body.Close()
	if err = srv.Db.EditLink(uint(id), link); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, link)
}
func (srv *Server) handleToggleVisibilityStatus(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "Invalid id")
	}
	log.infof("Toggling visibility status for link with id %d", id)
	if err := srv.Db.ToggleVisibilityStatus(id); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Visibility status toggled")
}
func (srv *Server) handleDeleteLink(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "Invalid id")
	}
	if err := srv.Db.DeleteLink(uint(id)); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Link deleted successfully")
}
