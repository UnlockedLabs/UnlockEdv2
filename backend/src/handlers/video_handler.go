package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/nats-io/nats.go"
)

func (srv *Server) registerVideoRoutes() []routeDef {
	axx := []models.FeatureAccess{models.OpenContentAccess}
	return []routeDef{
		{"GET /api/videos", srv.handleGetVideos, false, axx},
		{"GET /api/videos/{id}", srv.handleGetVideoById, false, axx},
		{"POST /api/videos", srv.handlePostVideos, true, axx},
		{"PUT /api/videos/{id}/{action}", srv.handleVideoAction, true, axx},
		{"PUT /api/videos/{id}/favorite", srv.handleFavoriteVideo, false, axx},
		{"DELETE /api/videos/{id}", srv.handleDeleteVideo, true, axx},
	}
}

func (srv *Server) handleGetVideos(w http.ResponseWriter, r *http.Request, log sLog) error {
	user := r.Context().Value(ClaimsKey).(*Claims)
	// cookie gets preference over query unless query specifies student
	onlyVisible := !user.isAdmin() || r.URL.Query().Get("visibility") == "student"
	args := srv.getQueryContext(r)
	videos, err := srv.Db.GetAllVideos(&args, onlyVisible)
	if err != nil {
		return newInternalServerServiceError(err, "error fetching videos")
	}
	return writePaginatedResponse(w, http.StatusOK, videos, args.IntoMeta())
}

func (srv *Server) handleGetVideoById(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newBadRequestServiceError(err, "error reading video id")
	}
	user := r.Context().Value(ClaimsKey).(*Claims)
	video, err := srv.Db.GetVideoByID(id)
	if err != nil {
		return newInternalServerServiceError(err, "error fetching video")
	}
	if !user.isAdmin() && !video.VisibilityStatus || video.Availability != models.VideoAvailable {
		return newForbiddenServiceError(errors.New("video not visible"), "you are not authorized to view this content")
	}
	videoViewerUrl := fmt.Sprintf("/viewer/videos/%d", video.ID)
	activity := models.OpenContentActivity{
		OpenContentProviderID: video.OpenContentProviderID,
		FacilityID:            user.FacilityID,
		UserID:                user.UserID,
		ContentID:             video.ID,
	}
	if !user.isAdmin() {
		srv.createContentActivityAndNotifyWS(videoViewerUrl, &activity)
	}
	return writeJsonResponse(w, http.StatusOK, video)
}

const (
	FeatureVideoAction     = "feature"
	ToggleVisibilityAction = "visibility"
	RetryVideoAction       = "retry"
)

func (srv *Server) handleVideoAction(w http.ResponseWriter, r *http.Request, log sLog) error {

	claims := r.Context().Value(ClaimsKey).(*Claims)
	userID, facilityID := claims.UserID, claims.FacilityID
	vidId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "video_id")
	}
	log.add("video_id", vidId)
	video, err := srv.Db.GetVideoByID(vidId)
	if err != nil {
		return newInvalidIdServiceError(err, "video_id")
	}

	handlerAction := r.PathValue("action")
	log.auditDetails(handlerAction)

	switch handlerAction {
	case FeatureVideoAction: // this is an admin only action, so pass the facilityID to 'feature' the content
		isFavorited, err := srv.Db.FavoriteOpenContent(vidId, video.OpenContentProviderID, userID, &facilityID)
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
		if err = srv.Db.ToggleVideoVisibility(vidId); err != nil {
			return newInternalServerServiceError(err, "error toggling video visibility")
		}
		log.auditDetails("visibility_toggled")
		return writeJsonResponse(w, http.StatusOK, "video visibility toggled")

	case RetryVideoAction:
		if len(video.Attempts) >= models.MAX_DOWNLOAD_ATTEMPTS {
			return newBadRequestServiceError(errors.New("max attempts reached"), "max download attempts reached, please remove video and try again")
		}
		msg := nats.NewMsg(models.RetryManualDownloadJob.PubName())
		body := make(map[string]interface{})
		body["video_id"] = video.ID
		body["open_content_provider_id"] = video.OpenContentProviderID
		body["job_type"] = models.RetryVideoDownloadsJob
		bodyBytes, err := json.Marshal(body)
		if err != nil {
			return newInternalServerServiceError(err, "error marshalling video")
		}
		msg.Data = bodyBytes
		if err := srv.nats.PublishMsg(msg); err != nil {
			return newInternalServerServiceError(err, "error publishing retry job")
		}
		return writeJsonResponse(w, http.StatusOK, "retry job published, please wait...")
	}
	return newBadRequestServiceError(errors.New("invalid action"), "invalid action")
}

func (srv *Server) handlePostVideos(w http.ResponseWriter, r *http.Request, log sLog) error {
	var video struct {
		VideoUrls []string `json:"video_urls"`
	}
	if err := json.NewDecoder(r.Body).Decode(&video); err != nil {
		return newBadRequestServiceError(err, "error reading video")
	}
	defer r.Body.Close()
	provider, err := srv.Db.GetVideoProvider()
	if err != nil {
		return newInternalServerServiceError(err, "error fetching video provider")
	}
	msg, err := getAddVideoNatsMsg(video.VideoUrls, provider)
	if err != nil {
		return newInternalServerServiceError(err, "error publishing add_video job")
	}
	if err = srv.nats.PublishMsg(msg); err != nil {
		return newInternalServerServiceError(err, "error publishing video")
	}
	return writeJsonResponse(w, http.StatusCreated, "videos added, processing")
}

func (srv *Server) handleDeleteVideo(w http.ResponseWriter, r *http.Request, log sLog) error {

	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newBadRequestServiceError(err, "error reading video id")
	}
	if err = srv.Db.DeleteVideo(id); err != nil {
		return newInternalServerServiceError(err, "error deleting video")
	}
	return writeJsonResponse(w, http.StatusOK, "video deleted")
}

func (srv *Server) handleFavoriteVideo(w http.ResponseWriter, r *http.Request, log sLog) error {
	userID := r.Context().Value(ClaimsKey).(*Claims).UserID
	vidId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "video_id")
	}
	video, err := srv.Db.GetVideoByID(vidId)
	if err != nil {
		return newInvalidIdServiceError(err, "video_id")
	}
	isFavorited, err := srv.Db.FavoriteOpenContent(vidId, video.OpenContentProviderID, userID, nil)
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

func getAddVideoNatsMsg(videoUrls []string, provider *models.OpenContentProvider) (*nats.Msg, error) {
	msg := nats.NewMsg(models.AddVideosJob.PubName())
	body := make(map[string]interface{})
	body["open_content_provider_id"] = provider.ID
	body["job_type"] = models.AddVideosJob
	body["video_urls"] = videoUrls
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	msg.Data = bodyBytes
	return msg, nil
}
