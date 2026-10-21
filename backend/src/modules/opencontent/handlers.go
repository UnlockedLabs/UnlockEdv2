package opencontent

import (
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"path"
	"slices"
	"strconv"
	"strings"

	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"

	"github.com/UnlockedLabs/unlocked-contracts/features"
	"github.com/sirupsen/logrus"
)

// routes is every Open Content route, with the access level and features it
// had in core (EN-192).
func (srv *server) routes() []module.Route {
	oc := []features.Access{features.OpenContent}
	videos := []features.Access{features.UploadVideo}
	links := []features.Access{features.HelpfulLinks}
	return []module.Route{
		// Libraries
		{Pattern: "GET /api/libraries", Handler: handle(srv.handleIndexLibraries), Features: oc},
		{Pattern: "GET /api/open-content/search", Handler: handle(srv.handleSearchOpenContent), Features: oc},
		{Pattern: "GET /api/open-content/suggestions", Handler: handle(srv.handleGetQuerySuggestions), Features: oc},
		{Pattern: "GET /api/libraries/{id}", Handler: handle(srv.handleGetLibrary), Features: oc},
		{Pattern: "PUT /api/libraries/{id}/favorite", Handler: handle(srv.handleToggleFavoriteLibrary), Features: oc},
		{Pattern: "PUT /api/libraries/{id}/toggle", Handler: handle(srv.handleToggleLibraryVisibility), Access: module.Admin, Features: oc},
		{Pattern: "GET /api/libraries/{id}/facilities", Handler: handle(srv.handleGetLibraryFacilityVisibility), Access: module.DeptAdmin, Features: oc},
		{Pattern: "PUT /api/libraries/{id}/facilities", Handler: handle(srv.handleSetLibraryFacilityVisibility), Access: module.DeptAdmin, Features: oc},

		// Open content
		{Pattern: "GET /api/open-content", Handler: handle(srv.handleIndexOpenContent), Features: oc},
		{Pattern: "GET /api/open-content/favorites", Handler: handle(srv.handleGetUserFavoriteOpenContent), Features: oc},
		{Pattern: "PUT /api/open-content/{id}/bookmark", Handler: handle(srv.handleBookmarkOpenContent), Features: oc},
		{Pattern: "GET /api/open-content/favorite-groupings", Handler: handle(srv.handleGetUserFavoriteOpenContentGroupings), Features: oc},
		{Pattern: "POST /api/open-content/request-content", Handler: handle(srv.handleRequestOpenContent), Features: []features.Access{features.OpenContent, features.RequestContent}},

		// Activity
		{Pattern: "GET /api/open-content/activity", Handler: handle(srv.handleGetTopFacilityOpenContent), Features: oc},
		{Pattern: "GET /api/open-content/activity/{id}", Handler: handle(srv.handleGetTopUserOpenContent), Features: oc},
		{Pattern: "GET /api/libraries/activity", Handler: handle(srv.handleGetTopFacilityLibraries), Features: oc},

		// Videos
		{Pattern: "GET /api/videos", Handler: handle(srv.handleGetVideos), Features: videos},
		{Pattern: "GET /api/videos/{id}", Handler: handle(srv.handleGetVideoById), Features: videos},
		{Pattern: "PUT /api/videos/{id}/favorite", Handler: handle(srv.handleFavoriteVideo), Features: videos},
		{Pattern: "POST /api/videos", Handler: handle(srv.handlePostVideos), Access: module.Admin, Features: videos},
		{Pattern: "PUT /api/videos/{id}/{action}", Handler: handle(srv.handleVideoAction), Access: module.Admin, Features: videos},
		{Pattern: "GET /api/videos/{id}/facilities", Handler: handle(srv.handleGetVideoFacilityVisibility), Access: module.DeptAdmin, Features: videos},
		{Pattern: "PUT /api/videos/{id}/facilities", Handler: handle(srv.handleSetVideoFacilityVisibility), Access: module.DeptAdmin, Features: videos},
		{Pattern: "DELETE /api/videos/{id}", Handler: handle(srv.handleDeleteVideo), Access: module.Admin, Features: videos},

		// Helpful links
		{Pattern: "GET /api/helpful-links", Handler: handle(srv.handleGetHelpfulLinks), Features: links},
		{Pattern: "PUT /api/helpful-links", Handler: handle(srv.handleAddHelpfulLink), Access: module.Admin, Features: links},
		{Pattern: "PATCH /api/helpful-links/{id}/edit", Handler: handle(srv.handleEditLink), Access: module.Admin, Features: links},
		{Pattern: "PUT /api/helpful-links/toggle/{id}", Handler: handle(srv.handleToggleVisibilityStatus), Access: module.Admin, Features: links},
		{Pattern: "DELETE /api/helpful-links/{id}", Handler: handle(srv.handleDeleteLink), Access: module.Admin, Features: links},
		{Pattern: "GET /api/helpful-links/facilities/{id}", Handler: handle(srv.handleGetLinkFacilityVisibility), Access: module.DeptAdmin, Features: links},
		{Pattern: "PUT /api/helpful-links/facilities/{id}", Handler: handle(srv.handleSetLinkFacilityVisibility), Access: module.DeptAdmin, Features: links},
		{Pattern: "PUT /api/helpful-links/activity/{id}", Handler: handle(srv.handleAddUserActivity), Features: links},
		{Pattern: "PUT /api/helpful-links/sort", Handler: handle(srv.changeSortOrder), Access: module.Admin, Features: links},
		{Pattern: "PUT /api/helpful-links/favorite/{id}", Handler: handle(srv.handleFavoriteLink), Features: links},

		// Library categories. Any logged-in user, like before the move.
		{Pattern: "GET /api/tags", Handler: handle(srv.handleGetTags)},

		// Proxies. They check Open Content themselves and send a user without
		// it back to log in, so the routes list no features.
		{Pattern: "GET /api/proxy/libraries/{id}/", Handler: srv.libraryProxyMiddleware(http.HandlerFunc(srv.handleForwardKiwixProxy))},
		{Pattern: "GET /api/proxy/videos/{id}", Handler: srv.videoProxyMiddleware(http.HandlerFunc(srv.handleRedirectVideosS3))},
	}
}

// Libraries

// Retrieves either a paginated list of libraries or all libraries based upon the HTTP request parameters.
// Query Parameters:
// page - the page number for pagination
// perPage - the number of libraries to display on page
// search - the title or patial title of the libraries to search for
// order_by - (title|created_at|most_popular) the order in which the results are returned
// visibility - can either be featured, visible, hidden, or all
// all - true or false on whether or not to return all libraries without pagination
// categories - the tag ids to filter the libraries by
func (srv *server) handleIndexLibraries(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := facilityScopedQueryContext(r)
	showHidden := "visible"
	if !userIsAdmin(r) && r.URL.Query().Get("visibility") == "hidden" {
		return newUnauthorizedServiceError()
	} else if !userIsAdmin(r) && r.URL.Query().Get("visibility") == "featured" {
		showHidden = "featured"
	} else if userIsAdmin(r) {
		showHidden = r.URL.Query().Get("visibility")
	}
	if len(args.Tags) > 0 {
		log.add("category_ids", strings.Join(args.Tags, ","))
		log.info("Libraries are being filtered by categories")
	}
	libraries, err := srv.store.GetAllLibraries(&args, showHidden)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, libraries, args.IntoMeta())
}

func (srv *server) handleGetLibrary(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "library id")
	}
	library, err := srv.store.GetLibraryByID(id)
	if err != nil {
		log.add("library_id", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, library)
}

func (srv *server) handleGetQuerySuggestions(w http.ResponseWriter, r *http.Request, log sLog) error {
	query := r.URL.Query().Get("query")
	if query == "" {
		return newBadRequestServiceError(errors.New("query parameter is required"), "query parameter is required")
	}
	log.add("search_query", query)
	escapedQuery := url.QueryEscape(query)
	searchUrl := fmt.Sprintf("https://suggestqueries.google.com/complete/search?safe=on&client=firefox&q=%s", escapedQuery)
	resp, err := http.Get(searchUrl)
	if err != nil {
		return newInternalServerServiceError(err, "error executing request to google_suggest")
	}
	defer func() {
		if resp.Body.Close() != nil {
			log.error("error closing response body")
		}
	}()
	if resp.StatusCode != http.StatusOK {
		return newBadRequestServiceError(errors.New("api call to google suggest failed"), "response contained unexpected status code from google suggest")
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return newInternalServerServiceError(err, "error reading body of response")
	}
	_, err = w.Write(body)
	return err
}

func (srv *server) handleSearchOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	page, perPage := getPaginationInfo(r)
	search := r.URL.Query().Get("search")
	log.add("search", search)
	log.info("Executing open content search")
	titleSearch := make([]OpenContentItem, 0, 1)
	var (
		err            error
		paginationData paginationMeta
		libraries      []Library
	)
	ids := r.URL.Query()["library_id"]
	libraryIDs := make([]int, 0, len(ids))
	for _, id := range ids {
		if libID, err := strconv.Atoi(id); err == nil {
			libraryIDs = append(libraryIDs, libID)
		}
	}
	// if we are on a library viewer page, we want to search
	// only the included library, so we omit title search
	queryCtx := facilityScopedQueryContext(r)
	if page == 1 && len(libraryIDs) == 0 {
		titleSearch, err = srv.store.OpenContentTitleSearch(&queryCtx)
		if err != nil {
			log.error("error performing title search on open content")
		}
	}
	if len(titleSearch) >= perPage {
		rss := RSS{}
		paginationData := newPaginationInfo(page, perPage, int64(len(titleSearch)))
		channels := make([]*OpenContentSearchResult, 0, 1)
		index := (page * perPage) - (perPage - 1)
		channels = append(channels, rss.SerializeSearchMeta(index, perPage, len(titleSearch), search))
		channels[0].AppendTitleSearchResults(titleSearch)
		return writePaginatedResponse(w, http.StatusOK, channels, paginationData)
	}
	if len(libraryIDs) > 0 {
		libraries, err = srv.store.GetLibrariesByIDsAndLang(libraryIDs, "eng")
	} else {
		libraries, err = srv.store.GetAllLibrariesByLang(&queryCtx, "eng")
	}
	if err != nil {
		log.add("library_ids", libraryIDs)
		return newDatabaseServiceError(err)
	}
	channels := make([]*OpenContentSearchResult, 0, 1) //only ever going to be one
	if len(libraries) > 0 {
		nextPage := (page-1)*perPage + 1
		queryParams := url.Values{}
		for _, library := range libraries {
			queryParams.Add("books.name", path.Base(library.Url))
		}
		queryParams.Add("format", "xml")
		queryParams.Add("pattern", search)
		kiwixSearchURL := fmt.Sprintf("%s/search?start=%d&pageLength=%d&%s", KiwixLibraryUrl, nextPage, perPage, queryParams.Encode())
		request, err := http.NewRequest(http.MethodGet, kiwixSearchURL, nil)
		log.add("kiwix_search_url", kiwixSearchURL)
		if err != nil {
			return newInternalServerServiceError(err, "unable to create new request to kiwix")
		}
		resp, err := srv.client.Do(request)
		if err != nil {
			return newInternalServerServiceError(err, "error executing kiwix search request")
		}
		defer func() {
			if resp.Body.Close() != nil {
				log.error("error closing response body")
			}
		}()
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
		var rss RSS
		err = xml.Unmarshal(body, &rss)
		if err != nil {
			return newInternalServerServiceError(err, "error parsing response body into XML")
		}
		total, err := strconv.ParseInt(strings.ReplaceAll(rss.Channel.TotalResults, ",", ""), 10, 64)
		if err != nil {
			return newInternalServerServiceError(err, "error parsing the total results value into an int64")
		}
		paginationData = newPaginationInfo(page, perPage, int64(total+int64(len(titleSearch))))
		channels = append(channels, rss.SerializeSearchResults(libraries))
	} else {
		paginationData = newPaginationInfo(page, perPage, int64(len(titleSearch)))
	}
	if page == 1 {
		if len(channels) > 0 { //if channels exist then append
			channels[0].AppendTitleSearchResults(titleSearch)
		} else if len(titleSearch) > 0 { //custom build titleSearch
			rss := RSS{}
			channels = append(channels, rss.SerializeSearchMeta(1, perPage, len(titleSearch), search))
			channels[0].AppendTitleSearchResults(titleSearch)
		} else { //custom build no results
			rss := RSS{}
			channels = append(channels, rss.SerializeSearchMeta(1, perPage, 0, search))
		}
		slices.Reverse(channels[0].Items)
	}
	return writePaginatedResponse(w, http.StatusOK, channels, paginationData)
}

func (srv *server) handleToggleLibraryVisibility(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := facilityScopedQueryContext(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "library id")
	}
	library, err := srv.store.ToggleVisibilityAndRetrieveLibrary(id, &args)
	if err != nil {
		log.add("library_id", id)
		return newDatabaseServiceError(err)
	}
	if srv.libraryPaths != nil { //make sure to update value in bucket if exists
		srv.updateLibraryBucket(r.PathValue("id"), library, log)
	}
	return writeJsonResponse(w, http.StatusOK, "Library visibility updated successfully")
}

func (srv *server) handleGetLibraryFacilityVisibility(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := facilityScopedQueryContext(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "library id")
	}
	visibilities, err := srv.store.GetLibraryFacilityVisibility(&args, id)
	if err != nil {
		log.add("library_id", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, visibilities)
}

type setFacilityVisibilityRequest struct {
	FacilityIDs      []uint `json:"facility_ids"`
	VisibilityStatus bool   `json:"visibility_status"`
}

func (srv *server) handleSetLibraryFacilityVisibility(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := facilityScopedQueryContext(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "library id")
	}
	var req setFacilityVisibilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	if len(req.FacilityIDs) == 0 {
		return newBadRequestServiceError(errors.New("facility_ids required"), "facility_ids required")
	}
	library, err := srv.setLibraryVisibility(&args, id, req.FacilityIDs, req.VisibilityStatus)
	if err != nil {
		log.add("library_id", id)
		return newDatabaseServiceError(err)
	}
	if srv.libraryPaths != nil && slices.Contains(req.FacilityIDs, args.FacilityID) {
		srv.updateLibraryBucket(r.PathValue("id"), library, log)
	}
	return writeJsonResponse(w, http.StatusOK, "Library visibility updated successfully")
}

func (srv *server) handleToggleFavoriteLibrary(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims := claimsFrom(r)
	libraryID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInternalServerServiceError(err, "error converting content id to int")
	}
	var facilityID *uint = nil
	if userIsAdmin(r) {
		// an admin toggling this will save the facilityID as a 'featured' library for that facility
		facilityID = &claims.FacilityID
	}
	library, err := srv.store.GetLibraryByID(libraryID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if _, err := srv.store.FavoriteOpenContent(libraryID, library.OpenContentProviderID, claims.UserID, facilityID); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Favorite toggled successfully")
}

func (srv *server) handleGetTags(w http.ResponseWriter, r *http.Request, log sLog) error {
	categories, err := srv.store.GetTags()
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, categories)
}

// Open content

func (srv *server) handleIndexOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	only := r.URL.Query().Get("all")
	var all bool
	if userIsAdmin(r) && strings.ToLower(strings.TrimSpace(only)) == "true" {
		all = true
	}
	content, err := srv.store.GetOpenContent(all)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, content)
}

func (srv *server) handleGetUserFavoriteOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := facilityScopedQueryContext(r)
	favorites, err := srv.store.GetUserFavorites(&args)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, favorites, args.IntoMeta())
}

func (srv *server) handleGetUserFavoriteOpenContentGroupings(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := facilityScopedQueryContext(r)
	favorites, err := srv.store.GetUserFavoriteGroupings(&args)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, favorites)
}

func (srv *server) handleBookmarkOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	var requestBody struct {
		Name                  string `json:"name,omitempty"`
		ContentURL            string `json:"content_url,omitempty"`
		OpenContentProviderId uint   `json:"open_content_provider_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	contentID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "Content ID")
	}
	contentParams := OpenContentParams{
		UserID:                claimsFrom(r).UserID,
		ContentID:             uint(contentID),
		Name:                  requestBody.Name,
		ContentURL:            requestBody.ContentURL,
		OpenContentProviderID: requestBody.OpenContentProviderId,
	}
	err = srv.store.BookmarkOpenContent(&contentParams)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Bookmark toggled successfully")
}

func (srv *server) handleRequestOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	var req struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return newBadRequestServiceError(err, "error reading content requests")
	}
	claims := claimsFrom(r)
	username := claims.Username
	facilityName := claims.FacilityName
	subject := "Content Request - " + username + " - " + facilityName
	bodyHTML := getBodyHTML(username, facilityName, req.Content)
	err := srv.sendEmail(r.Context(), subject, "Content requests recieved for UnlockEd", bodyHTML)
	if err != nil {
		return newBadRequestServiceError(err, "error sending email")
	}
	return writeJsonResponse(w, http.StatusOK, "content requests sent")
}

func getBodyHTML(username, facility, bodyText string) string {
	pasteableString := `=SPLIT("` + username + `|` + facility + `|` + bodyText + `", "|")`
	return fmt.Sprintf(`<div style="font-family: Arial, sans-serif; font-size: 16px;">
        <p>Content Request from %s at %s</p>
        <p>We have received the following information:</p>
		<h3>Username</h3>
		<p>%s</p>
		<h3>Facility Name</h3>
		<p>%s</p>
		<h3>Content Request</h3>
		<p>%s</p>
		<p>Pasteable string for quick import into csv file:</p>
		<p>%s</p>
    </div>`, html.EscapeString(username), html.EscapeString(facility), html.EscapeString(username), html.EscapeString(facility), html.EscapeString(bodyText), pasteableString)
}

// Activity

func (srv *server) handleGetTopFacilityOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	facilityId := claimsFrom(r).FacilityID
	topOpenContent, err := srv.store.GetTopFacilityOpenContent(int(facilityId))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, topOpenContent)
}

func (srv *server) handleGetTopUserOpenContent(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := facilityScopedQueryContext(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	topOpenContent, err := srv.store.GetTopUserOpenContent(id, &args)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, topOpenContent)
}

func (srv *server) handleGetTopFacilityLibraries(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := getQueryContext(r)
	facilityId := claimsFrom(r).FacilityID
	_, perPage := getPaginationInfo(r)
	start, end, err := parseDateRangeRequest(r)
	if err != nil {
		return err
	}
	topLibraries, err := srv.store.GetTopFacilityLibraries(&args, int(facilityId), perPage, start, end)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, topLibraries)
}

// Videos

var errInvalidVideoURL = errors.New("invalid video URL")

func validateVideoURL(urlStr string) error {
	u, err := url.Parse(urlStr)
	if err != nil {
		return fmt.Errorf("%w: %v", errInvalidVideoURL, err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("%w: scheme must be http or https", errInvalidVideoURL)
	}
	if u.Host == "" {
		return fmt.Errorf("%w: missing host", errInvalidVideoURL)
	}
	if strings.ContainsAny(urlStr, ";<>|&$`\\\"'") {
		return fmt.Errorf("%w: contains invalid characters", errInvalidVideoURL)
	}
	lowerURL := strings.ToLower(urlStr)
	if strings.ContainsAny(urlStr, "\n\r") || strings.Contains(lowerURL, "%0a") || strings.Contains(lowerURL, "%0d") {
		return fmt.Errorf("%w: contains newline characters", errInvalidVideoURL)
	}
	return nil
}

func (srv *server) handleGetVideos(w http.ResponseWriter, r *http.Request, log sLog) error {
	user := claimsFrom(r)
	visibility := r.URL.Query().Get("visibility")

	if !user.IsAdmin() {
		visibility = "visible"
	}
	args := facilityScopedQueryContext(r)
	videos, err := srv.store.GetAllVideos(&args, visibility)
	if err != nil {
		return newInternalServerServiceError(err, "error fetching videos")
	}
	return writePaginatedResponse(w, http.StatusOK, videos, args.IntoMeta())
}

func (srv *server) handleGetVideoById(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newBadRequestServiceError(err, "error reading video id")
	}
	user := claimsFrom(r)
	video, err := srv.store.GetVideoByID(id, user.FacilityID)
	if err != nil {
		return newInternalServerServiceError(err, "error fetching video")
	}
	if !user.IsAdmin() && !video.VisibilityStatus || video.Availability != VideoAvailable {
		return newForbiddenServiceError(errors.New("video not visible"), "you are not authorized to view this content")
	}
	videoViewerUrl := fmt.Sprintf("/viewer/videos/%d", video.ID)
	activity := OpenContentActivity{
		OpenContentProviderID: video.OpenContentProviderID,
		FacilityID:            user.FacilityID,
		UserID:                user.UserID,
		ContentID:             video.ID,
	}
	if !user.IsAdmin() {
		srv.createContentActivityAndNotifyWS(videoViewerUrl, &activity)
	}
	return writeJsonResponse(w, http.StatusOK, video)
}

const (
	FeatureVideoAction     = "feature"
	ToggleVisibilityAction = "visibility"
	RetryVideoAction       = "retry"
)

func (srv *server) handleVideoAction(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims := claimsFrom(r)
	userID, facilityID := claims.UserID, claims.FacilityID
	vidId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "video_id")
	}
	video, err := srv.store.GetVideoByID(vidId, claims.FacilityID)
	if err != nil {
		return newInvalidIdServiceError(err, "video_id")
	}

	switch r.PathValue("action") {
	case FeatureVideoAction: // this is an admin only action, so pass the facilityID to 'feature' the content
		isFavorited, err := srv.store.FavoriteOpenContent(vidId, video.OpenContentProviderID, userID, &facilityID)
		if err != nil {
			return newInternalServerServiceError(err, "error favoriting video")
		}
		msg := ""
		if isFavorited {
			msg = "video added to featured list"
		} else {
			msg = "video removed from featured list"
		}
		log.auditDetails("video_featured")
		return writeJsonResponse(w, http.StatusOK, msg)

	case ToggleVisibilityAction:
		if err = srv.store.ToggleVideoVisibility(r.Context(), vidId, facilityID); err != nil {
			return newInternalServerServiceError(err, "error toggling video visibility")
		}
		log.auditDetails("visibility_toggled")
		return writeJsonResponse(w, http.StatusOK, "video visibility toggled")

	case RetryVideoAction:
		log.auditDetails("retry_video_download")
		if len(video.Attempts) >= MAX_DOWNLOAD_ATTEMPTS {
			return newBadRequestServiceError(errors.New("max attempts reached"), "max download attempts reached, please remove video and try again")
		}
		msg, err := retryManualDownloadMsg(video)
		if err != nil {
			return newInternalServerServiceError(err, "error marshalling video")
		}
		if err := srv.nats.PublishMsg(msg); err != nil {
			return newInternalServerServiceError(err, "error publishing retry job")
		}
		return writeJsonResponse(w, http.StatusOK, "retry job published, please wait...")
	}
	return newBadRequestServiceError(errors.New("invalid action"), "invalid action")
}

func (srv *server) handleGetVideoFacilityVisibility(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := facilityScopedQueryContext(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "video id")
	}
	visibilities, err := srv.store.GetVideoFacilityVisibility(&args, id)
	if err != nil {
		log.add("video_id", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, visibilities)
}

func (srv *server) handleSetVideoFacilityVisibility(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := facilityScopedQueryContext(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "video id")
	}
	var req setFacilityVisibilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	if len(req.FacilityIDs) == 0 {
		return newBadRequestServiceError(errors.New("facility_ids required"), "facility_ids required")
	}
	if err := srv.setVideoVisibility(&args, id, req.FacilityIDs, req.VisibilityStatus); err != nil {
		log.add("video_id", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Video visibility updated successfully")
}

func (srv *server) handlePostVideos(w http.ResponseWriter, r *http.Request, log sLog) error {
	var video struct {
		VideoUrls []string `json:"video_urls"`
	}
	if err := json.NewDecoder(r.Body).Decode(&video); err != nil {
		return newBadRequestServiceError(err, "error reading video")
	}
	if len(video.VideoUrls) == 0 {
		return newBadRequestServiceError(errors.New("no video URLs provided"), "video_urls is required")
	}
	for _, videoURL := range video.VideoUrls {
		if err := validateVideoURL(videoURL); err != nil {
			return newBadRequestServiceError(err, "invalid video URL")
		}
	}
	provider, err := srv.store.GetVideoProvider()
	if err != nil {
		return newInternalServerServiceError(err, "error fetching video provider")
	}
	msg, err := addVideosMsg(video.VideoUrls, provider)
	if err != nil {
		return newInternalServerServiceError(err, "error publishing add_video job")
	}
	if err = srv.nats.PublishMsg(msg); err != nil {
		return newInternalServerServiceError(err, "error publishing video")
	}
	return writeJsonResponse(w, http.StatusCreated, "videos added, processing")
}

func (srv *server) handleDeleteVideo(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newBadRequestServiceError(err, "error reading video id")
	}
	if err = srv.store.DeleteVideo(id); err != nil {
		return newInternalServerServiceError(err, "error deleting video")
	}
	return writeJsonResponse(w, http.StatusOK, "video deleted")
}

func (srv *server) handleFavoriteVideo(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims := claimsFrom(r)
	userID := claims.UserID

	vidId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "video_id")
	}
	video, err := srv.store.GetVideoByID(vidId, claims.FacilityID)
	if err != nil {
		return newInvalidIdServiceError(err, "video_id")
	}
	isFavorited, err := srv.store.FavoriteOpenContent(vidId, video.OpenContentProviderID, userID, nil)
	if err != nil {
		return newInternalServerServiceError(err, "error favoriting video")
	}
	msg := ""
	if isFavorited {
		msg = "video added to favorites"
	} else {
		msg = "video removed from favorites"
	}
	return writeJsonResponse(w, http.StatusOK, msg)
}

// Helpful links

// helpfulSortOrder is each facility's helpful-links sort order. It is kept in
// memory only, as it was in core.
var helpfulSortOrder = make(map[uint]string)

func (srv *server) changeSortOrder(w http.ResponseWriter, r *http.Request, log sLog) error {
	type reqBody struct {
		SortOrder string `json:"sort_order"`
	}
	var req reqBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	facilityID := claimsFrom(r).FacilityID
	helpfulSortOrder[facilityID] = req.SortOrder
	return writeJsonResponse(w, http.StatusOK, "Sort order changed successfully")
}

func (srv *server) handleGetHelpfulLinks(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := facilityScopedQueryContext(r)
	onlyVisible := r.URL.Query().Get("visibility") == "true"
	if !userIsAdmin(r) {
		onlyVisible = true
	}
	links, err := srv.store.GetHelpfulLinks(&args, onlyVisible)
	if err != nil {
		return newInternalServerServiceError(err, "error fetching helpful links")
	}
	respSort := struct {
		SortOrder string            `json:"sort_order"`
		Links     []HelpfulLinkResp `json:"helpful_links"`
		Meta      paginationMeta    `json:"meta"`
	}{SortOrder: helpfulSortOrder[claimsFrom(r).FacilityID], Links: links, Meta: args.IntoMeta()}
	return writeJsonResponse(w, http.StatusOK, respSort)
}

func (srv *server) handleAddHelpfulLink(w http.ResponseWriter, r *http.Request, log sLog) error {
	var link HelpfulLink
	err := json.NewDecoder(r.Body).Decode(&link)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	args := facilityScopedQueryContext(r)
	link.ThumbnailUrl = nilIfBlank(getFavicon(link.Url))
	log.infof("Adding helpful link icon %s", formatNullableString(link.ThumbnailUrl))
	if err := srv.store.AddHelpfulLink(r.Context(), &args, &link); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, "Link added successfully")
}

func (srv *server) handleEditLink(w http.ResponseWriter, r *http.Request, log sLog) error {
	var link HelpfulLink
	err := json.NewDecoder(r.Body).Decode(&link)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "Invalid id")
	}
	link.ThumbnailUrl = nilIfBlank(getFavicon(link.Url))
	if err = srv.store.EditLink(r.Context(), uint(id), link); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, link)
}

func (srv *server) handleToggleVisibilityStatus(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "Invalid id")
	}
	log.infof("Toggling visibility status for link with id %d", id)
	args := facilityScopedQueryContext(r)
	if err := srv.store.ToggleVisibilityStatus(r.Context(), &args, id); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Visibility status toggled")
}

func (srv *server) handleGetLinkFacilityVisibility(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := facilityScopedQueryContext(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "link id")
	}
	visibilities, err := srv.store.GetHelpfulLinkFacilityVisibility(&args, id)
	if err != nil {
		log.add("link_id", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, visibilities)
}

func (srv *server) handleSetLinkFacilityVisibility(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := facilityScopedQueryContext(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "link id")
	}
	var req setFacilityVisibilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	if len(req.FacilityIDs) == 0 {
		return newBadRequestServiceError(errors.New("facility_ids required"), "facility_ids required")
	}
	if err := srv.setHelpfulLinkVisibility(&args, id, req.FacilityIDs, req.VisibilityStatus); err != nil {
		log.add("link_id", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Link visibility updated successfully")
}

func (srv *server) handleDeleteLink(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "Invalid id")
	}
	if err := srv.store.DeleteLink(r.Context(), uint(id)); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Link deleted successfully")
}

func (srv *server) handleAddUserActivity(w http.ResponseWriter, r *http.Request, log sLog) error {
	var activity OpenContentActivity
	claims := claimsFrom(r)
	linkID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "Invalid id")
	}
	link, err := srv.store.GetLinkFromId(uint(linkID))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	openContentProviderID, err := srv.store.GetHelpfulLinkOpenContentProviderId()
	if err != nil {
		return newDatabaseServiceError(err)
	}

	activity.UserID = claims.UserID
	activity.FacilityID = claims.FacilityID
	activity.ContentID = link.ID
	activity.OpenContentProviderID = openContentProviderID
	srv.store.CreateContentActivity(link.Url, &activity)
	return writeJsonResponse(w, http.StatusOK, map[string]string{
		"url": link.Url,
	})
}

func (srv *server) handleFavoriteLink(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims := claimsFrom(r)
	userID := claims.UserID
	linkID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "Invalid id")
	}
	facilityID := &claims.FacilityID
	if !userIsAdmin(r) {
		facilityID = nil
	}
	link, err := srv.store.GetLinkFromId(uint(linkID))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if _, err := srv.store.FavoriteOpenContent(int(linkID), link.OpenContentProviderID, uint(userID), facilityID); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "Link favorite toggled successfully")
}

func getFavicon(link string) string {
	logrus.Printf("Getting favicon for link %s", link)
	parsed, err := url.Parse(link)
	if err != nil || parsed.Hostname() == "" {
		return "/ul-logo-d.svg"
	}
	domain := parsed.Hostname()
	return fmt.Sprintf("https://www.google.com/s2/favicons?domain=%s&sz=64", domain)
}
