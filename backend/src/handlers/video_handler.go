package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/nats-io/nats.go"
)

func (srv *Server) registerVideoRoutes() {
	srv.Mux.Handle("GET /api/videos", srv.applyMiddleware(srv.handleGetVideos))
	srv.Mux.Handle("GET /api/videos/{id}", srv.applyMiddleware(srv.handleGetVideoById))
	srv.Mux.Handle("POST /api/videos", srv.applyAdminMiddleware(srv.handlePostVideos))
	srv.Mux.Handle("PUT /api/videos/{id}/{action}", srv.applyAdminMiddleware(srv.handleVideoAction))
	srv.Mux.Handle("DELETE /api/videos/{id}", srv.applyAdminMiddleware(srv.handleDeleteVideo))
}

func (srv *Server) handleGetVideos(w http.ResponseWriter, r *http.Request, log sLog) error {
	user := r.Context().Value(ClaimsKey).(*Claims)
	// cookie gets preference over query unless query specifies student
	onlyVisible := user.Role == models.Student || r.URL.Query().Get("visibility") == "student"
	search := r.URL.Query().Get("search")
	orderBy := r.URL.Query().Get("order_by")
	page, perPage := srv.getPaginationInfo(r)
	total, videos, err := srv.Db.GetAllVideos(onlyVisible, page, perPage, search, orderBy, user.UserID)
	if err != nil {
		return newInternalServerServiceError(err, "error fetching videos")
	}
	meta := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, videos, meta)
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
	if user.Role != models.Admin && !video.VisibilityStatus || video.Availability != models.VideoAvailable {
		return newForbiddenServiceError(errors.New("video not visible"), "you are not authorized to view this content")
	}
	return writeJsonResponse(w, http.StatusOK, video)
}

const (
	FavoriteVideoAction    = "favorite"
	ToggleVisibilityAction = "visibility"
	RetryVideoAction       = "retry"
)

func (srv *Server) handleVideoAction(w http.ResponseWriter, r *http.Request, log sLog) error {
	userID := r.Context().Value(ClaimsKey).(*Claims).UserID
	vidId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "video_id")
	}
	video, err := srv.Db.GetVideoByID(vidId)
	if err != nil {
		return newInvalidIdServiceError(err, "video_id")
	}
	switch r.PathValue("action") {

	case FavoriteVideoAction:
		isFavorited, err := srv.Db.FavoriteVideo(vidId, userID)
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

	case ToggleVisibilityAction:
		if err = srv.Db.ToggleVideoVisibility(vidId); err != nil {
			return newInternalServerServiceError(err, "error toggling video visibility")
		}
		return writeJsonResponse(w, http.StatusOK, "video visibility toggled")

	case RetryVideoAction:
		if len(video.Attempts) >= models.MAX_DOWNLOAD_ATTEMPTS {
			return newBadRequestServiceError(errors.New("max attempts reached"), "max download attempts reached, please remove video and try again")
		}
		msg := nats.NewMsg(models.RetryManualDownloadJob.PubName())
		body := make(map[string]interface{})
		log.add("video_id", video.ID)
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
