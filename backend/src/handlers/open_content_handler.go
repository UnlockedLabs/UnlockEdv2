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
		{"GET /api/open-content/favorites", srv.handleGetUserFavoriteOpenContent, false, axx},
		{"PUT /api/open-content/{id}/bookmark", srv.handleBookmarkOpenContent, false, axx},
		{"GET /api/open-content/favorite-groupings", srv.handleGetUserFavoriteOpenContentGroupings, false, axx},
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
	search := r.URL.Query().Get("search")
	orderBy := r.URL.Query().Get("order_by")
	total, favorites, err := srv.Db.GetUserFavorites(srv.getUserID(r), page, perPage, orderBy, search)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	meta := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, favorites, meta)
}

func (srv *Server) handleGetUserFavoriteOpenContentGroupings(w http.ResponseWriter, r *http.Request, log sLog) error {
	favorites, err := srv.Db.GetUserFavoriteGroupings(srv.getUserID(r))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, favorites)
}

func (srv *Server) handleBookmarkOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	var requestBody struct {
		Name                  string `json:"name,omitempty"`
		ContentURL            string `json:"content_url,omitempty"`
		OpenContentProviderId uint   `json:"open_content_provider_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()
	contentID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "Content ID")
	}
	userID := srv.getUserID(r)
	contentParams := models.OpenContentParams{
		UserID:                userID,
		ContentID:             uint(contentID),
		Name:                  requestBody.Name,
		ContentURL:            requestBody.ContentURL,
		OpenContentProviderID: requestBody.OpenContentProviderId,
	}
	err = srv.Db.BookmarkOpenContent(&contentParams)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Bookmark toggled successfully")
}
