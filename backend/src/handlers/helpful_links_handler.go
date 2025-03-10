package handlers

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"

	"github.com/sirupsen/logrus"
)

func (srv *Server) registerLeftMenuRoutes() []routeDef {
	axx := models.Feature()
	return []routeDef{
		{"GET /api/helpful-links", srv.handleGetHelpfulLinks, false, axx},
		{"PUT /api/helpful-links", srv.handleAddHelpfulLink, true, axx},
		{"PATCH /api/helpful-links/{id}/edit", srv.handleEditLink, true, axx},
		{"PUT /api/helpful-links/toggle/{id}", srv.handleToggleVisibilityStatus, true, axx},
		{"DELETE /api/helpful-links/{id}", srv.handleDeleteLink, true, axx},
		{"PUT /api/helpful-links/activity/{id}", srv.handleAddUserActivity, false, axx},
		{"PUT /api/helpful-links/sort", srv.changeSortOrder, true, axx},
		{"PUT /api/helpful-links/favorite/{id}", srv.handleFavoriteLink, false, axx},
	}
}

var HelpfulSortOrder = make(map[uint]string)

func (srv *Server) changeSortOrder(w http.ResponseWriter, r *http.Request, log sLog) error {
	type reqBody struct {
		SortOrder string `json:"sort_order"`
	}
	var req reqBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()
	facilityID := srv.getFacilityID(r)
	HelpfulSortOrder[facilityID] = req.SortOrder
	return writeJsonResponse(w, http.StatusOK, "Sort order changed successfully")
}

func (srv *Server) handleGetHelpfulLinks(w http.ResponseWriter, r *http.Request, log sLog) error {
	search := r.URL.Query().Get("search")
	orderBy := r.URL.Query().Get("order_by")
	onlyVisible := r.URL.Query().Get("visibility") == "true"
	if !userIsAdmin(r) {
		onlyVisible = true
	}
	userID := srv.getUserID(r)
	page, perPage := srv.getPaginationInfo(r)
	total, links, err := srv.Db.GetHelpfulLinks(page, perPage, search, orderBy, onlyVisible, userID)
	if err != nil {
		return newInternalServerServiceError(err, "error fetching helpful links")
	}
	meta := models.NewPaginationInfo(page, perPage, total)
	respSort := struct {
		SortOrder string                     `json:"sort_order"`
		Links     []database.HelpfulLinkResp `json:"helpful_links"`
		Meta      models.PaginationMeta      `json:"meta"`
	}{SortOrder: HelpfulSortOrder[srv.getFacilityID(r)], Links: links, Meta: meta}

	return writeJsonResponse(w, http.StatusOK, respSort)
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
	link.ThumbnailUrl = srv.getFavicon(link.Url)
	log.infof("Adding helpful link icon %s", link.ThumbnailUrl)
	if err := srv.Db.AddHelpfulLink(&link); err != nil {
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
	link.ThumbnailUrl = srv.getFavicon(link.Url)
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

func (srv *Server) handleAddUserActivity(w http.ResponseWriter, r *http.Request, log sLog) error {
	var activity models.OpenContentActivity
	userID := srv.getUserID(r)
	facilityID := srv.getFacilityID(r)
	linkID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "Invalid id")
	}
	link, err := srv.Db.GetLinkFromId(uint(linkID))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	openContentProviderID, err := srv.Db.GetHelpfulLinkOpenContentProviderId()
	if err != nil {
		return newDatabaseServiceError(err)
	}

	activity.UserID = userID
	activity.FacilityID = facilityID
	activity.ContentID = link.ID
	activity.OpenContentProviderID = openContentProviderID
	srv.Db.CreateContentActivity(link.Url, &activity)
	return writeJsonResponse(w, http.StatusOK, map[string]string{
		"url": link.Url,
	})
}

func (srv *Server) handleFavoriteLink(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims := r.Context().Value(ClaimsKey).(*Claims)
	userID := claims.UserID
	linkID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "Invalid id")
	}
	facilityID := &claims.FacilityID
	if !userIsAdmin(r) {
		facilityID = nil
	}
	link, err := srv.Db.GetLinkFromId(uint(linkID))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if _, err := srv.Db.FavoriteOpenContent(int(linkID), link.OpenContentProviderID, uint(userID), facilityID); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Link favorite toggled successfully")
}

func (srv *Server) getFavicon(link string) string {
	logrus.Printf("Getting favicon for link %s", link)
	parsed, err := url.Parse(link)
	if err != nil || parsed.Hostname() == "" {
		return "/ul-logo.png"
	}
	domain := parsed.Hostname()
	return fmt.Sprintf("https://www.google.com/s2/favicons?domain=%s&sz=64", domain)
}
