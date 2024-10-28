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
	srv.Mux.Handle("PUT /api/videos/{id}/toggle", srv.applyAdminMiddleware(srv.handleToggleVideoVisibility))
	srv.Mux.Handle("DELETE /api/videos/{id}", srv.applyAdminMiddleware(srv.handleDeleteVideo))
}

func (srv *Server) handleGetVideos(w http.ResponseWriter, r *http.Request, log sLog) error {
	user := r.Context().Value(ClaimsKey).(*Claims)
	onlyVisible := user.Role == models.Student
	page, perPage := srv.getPaginationInfo(r)
	videos, err := srv.Db.GetAllVideos(onlyVisible, page, perPage)
	if err != nil {
		return newInternalServerServiceError(err, "error fetching videos")
	}
	return writeJsonResponse(w, http.StatusOK, videos)
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

func (srv *Server) handlePostVideos(w http.ResponseWriter, r *http.Request, log sLog) error {
	var video struct {
		VideoUrls []string `json:"video_urls"`
	}
	if err := json.NewDecoder(r.Body).Decode(&video); err != nil {
		return newBadRequestServiceError(err, "error reading video")
	}
	provider, err := srv.Db.GetVideoProvider()
	if err != nil {
		return newInternalServerServiceError(err, "error fetching video provider")
	}
	msg := nats.NewMsg(models.AddVideosJob.PubName())
	body := make(map[string]interface{})
	body["open_content_provider_id"] = provider.ID
	body["job_type"] = models.AddVideosJob
	body["video_urls"] = video.VideoUrls
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return newInternalServerServiceError(err, "error marshalling video")
	}
	msg.Data = bodyBytes
	if err = srv.nats.PublishMsg(msg); err != nil {
		return newInternalServerServiceError(err, "error publishing video")
	}
	return writeJsonResponse(w, http.StatusCreated, "videos added, processing")
}

func (srv *Server) handleToggleVideoVisibility(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newBadRequestServiceError(err, "error reading video id")
	}
	if err = srv.Db.ToggleVideoVisibility(id); err != nil {
		return newInternalServerServiceError(err, "error toggling video visibility")
	}
	return writeJsonResponse(w, http.StatusOK, "video visibility toggled")
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
