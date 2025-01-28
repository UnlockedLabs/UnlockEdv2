package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
)

func (srv *Server) registerLibraryRoutes() []routeDef {
	axx := models.Feature(models.OpenContentAccess)
	return []routeDef{
		{"GET /api/libraries", srv.handleIndexLibraries, false, axx},
		{"GET /api/libraries/search", srv.handleSearchLibraries, false, axx},
		{"GET /api/libraries/{id}", srv.handleGetLibrary, false, axx},
		{"PUT /api/libraries/{id}/toggle", srv.handleToggleLibraryVisibility, true, axx},
		{"PUT /api/libraries/{id}/favorite", srv.handleToggleFavoriteLibrary, false, axx},
	}
}

// Retrieves either a paginated list of libraries or all libraries based upon the HTTP request parameters.
// Query Parameters:
// page - the page number for pagination
// perPage - the number of libraries to display on page
// search - the title or patial title of the libraries to search for
// order_by - (title|created_at|most_popular) the order in which the results are returned
// visibility - can either be featured, visible, hidden, or all
// all - true or false on whether or not to return all libraries without pagination
func (srv *Server) handleIndexLibraries(w http.ResponseWriter, r *http.Request, log sLog) error {
	page, perPage := srv.getPaginationInfo(r)
	search := r.URL.Query().Get("search")
	orderBy := r.URL.Query().Get("order_by")
	all := r.URL.Query().Get("all") == "true"
	days, err := strconv.Atoi(r.URL.Query().Get("days"))
	if err != nil {
		days = -1
	}
	showHidden := "visible"
	if !userIsAdmin(r) && r.URL.Query().Get("visibility") == "hidden" {
		return newUnauthorizedServiceError()
	} else if !userIsAdmin(r) && r.URL.Query().Get("visibility") == "featured" {
		showHidden = "featured"
	} else if userIsAdmin(r) {
		showHidden = r.URL.Query().Get("visibility")
	}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	total, libraries, err := srv.Db.GetAllLibraries(page, perPage, days, claims.UserID, claims.FacilityID, showHidden, orderBy, search, claims.isAdmin(), all)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	paginationData := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, libraries, paginationData)
}

func (srv *Server) handleGetLibrary(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "library id")
	}
	library, err := srv.Db.GetLibraryByID(id)
	if err != nil {
		log.add("library_id", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, library)
}

func (srv *Server) handleSearchLibraries(w http.ResponseWriter, r *http.Request, log sLog) error {
	page, perPage := srv.getPaginationInfo(r)
	search := r.URL.Query().Get("search")
	ids := r.URL.Query()["library_id"]
	libraryIDs := make([]int, 0, len(ids))
	for _, id := range ids {
		if libID, err := strconv.Atoi(id); err == nil {
			libraryIDs = append(libraryIDs, libID)
		}
	}
	libraries, err := srv.Db.GetLibrariesByIDs(libraryIDs)
	if err != nil {
		log.add("library_ids", libraryIDs)
		return newDatabaseServiceError(err)
	}
	nextPage := (page-1)*perPage + 1
	queryParams := url.Values{}
	for _, library := range libraries {
		queryParams.Add("books.name", path.Base(library.Url))
	}
	queryParams.Add("format", "xml")
	queryParams.Add("pattern", search)
	kiwixSearchURL := fmt.Sprintf("%s/search?start=%d&pageLength=%d&%s", models.KiwixLibraryUrl, nextPage, perPage, queryParams.Encode())
	request, err := http.NewRequest(http.MethodGet, kiwixSearchURL, nil)
	log.add("kiwix_search_url", kiwixSearchURL)
	if err != nil {
		return newInternalServerServiceError(err, "unable to create new request to kiwix")
	}
	resp, err := srv.Client.Do(request)
	if err != nil {
		return newInternalServerServiceError(err, "error executing kiwix search request")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.add("status_code", resp.StatusCode)
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return newInternalServerServiceError(err, "executing request returned unexpected status, and failed to read error from its response")
		}
		log.add("kiwix_error", string(body))
		return newBadRequestServiceError(errors.New("api call to kiwix failed"), "response contained unexpected status code from kiwix")
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return newInternalServerServiceError(err, "error reading body of response")
	}
	var rss models.RSS
	err = xml.Unmarshal(body, &rss)
	if err != nil {
		return newInternalServerServiceError(err, "error parsing response body into XML")
	}
	total, err := strconv.ParseInt(strings.ReplaceAll(rss.Channel.TotalResults, ",", ""), 10, 64)
	if err != nil {
		return newInternalServerServiceError(err, "error parsing the total results value into an int64")
	}
	paginationData := models.NewPaginationInfo(page, perPage, int64(total))
	channels := make([]*models.KiwixChannel, 0, 1) //only ever going to be one KiwixChannel
	channels = append(channels, rss.IntoKiwixChannel(libraries))
	return writePaginatedResponse(w, http.StatusOK, channels, paginationData)
}

func (srv *Server) handleToggleLibraryVisibility(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "library id")
	}
	library, err := srv.Db.ToggleVisibilityAndRetrieveLibrary(id)
	if err != nil {
		log.add("library_id", id)
		return newDatabaseServiceError(err)
	}
	if srv.buckets != nil { //make sure to update value in bucket if exists
		srv.updateLibraryBucket(r.PathValue("id"), library, log)
	}
	return writeJsonResponse(w, http.StatusOK, "Library visibility updated successfully")
}

func (srv *Server) updateLibraryBucket(key string, library *models.Library, log sLog) {
	var proxyParams *models.LibraryProxyPO
	libraryBucket := srv.buckets[LibraryPaths]
	entry, err := libraryBucket.Get(key)
	if err == nil {
		err = json.Unmarshal(entry.Value(), &proxyParams)
		if err != nil {
			log.warn("unable to unmarshal value from LibaryPaths bucket")
			return
		}
		proxyParams.VisibilityStatus = library.VisibilityStatus
	} else { //build a one for the bucket
		proxyParams = library.IntoProxyPO()
	}
	marshaledParams, err := json.Marshal(proxyParams)
	if err != nil {
		log.warn("unable to marshal value to put into the LibaryPaths bucket")
		return
	}
	if _, err := libraryBucket.Put(key, marshaledParams); err != nil {
		log.warnf("unable to update value within LibaryPaths bucket, error is %v", err)
	}
}

func (srv *Server) handleToggleFavoriteLibrary(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims := r.Context().Value(ClaimsKey).(*Claims)
	libraryID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInternalServerServiceError(err, "error converting content id to int")
	}
	var facilityID *uint = nil
	if userIsAdmin(r) {
		// an admin toggling this will save the facilityID as a 'featured' library for that facility
		facilityID = &claims.FacilityID
	}
	library, err := srv.Db.GetLibraryByID(libraryID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if _, err := srv.Db.FavoriteOpenContent(libraryID, library.OpenContentProviderID, claims.UserID, facilityID); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Favorite toggled successfully")
}
