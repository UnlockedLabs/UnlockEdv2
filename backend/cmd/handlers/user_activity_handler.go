package handlers

import (
	"Go-Prototype/backend/cmd/database"
	"Go-Prototype/backend/cmd/models"
	"log"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
)

func (srv *Server) registerUserActivityRoutes() {
	srv.Mux.Handle("GET /api/users/activity-log", srv.applyAdminMiddleware(http.HandlerFunc(srv.handleGetAllUserActivities)))
	srv.Mux.Handle("GET /api/users/{id}/activity-log", srv.applyMiddleware(http.HandlerFunc(srv.handleGetUserActivityByID)))
}

func (srv *Server) UserActivityMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userAgent := r.Header.Get("User-Agent")
		if userAgent == "" {
			userAgent = "Unknown; Unknown"
		}
		log.Printf("User-Agent: %s\n", userAgent)
		os := "Unknown"
		arch := "Unknown"

		osArch := strings.Split(userAgent, ";")
		if len(osArch) > 1 {
			os = strings.Split(osArch[0], " ")[0]
			arch = strings.Split(osArch[1], " ")[1]
			if os == "" || arch == "" {
				os = "Unknown"
				arch = "Unknown"
			}
		}
		split := strings.Split(userAgent, " ")
		last := split[len(split)-1]

		browser := "Unknown"
		if strings.Contains(last, "Chrome") {
			browser = "Chrome"
		} else if strings.Contains(last, "Firefox") {
			browser = "Firefox"
		} else if strings.Contains(last, "Safari") {
			browser = "Safari"
		} else if strings.Contains(last, "Edge") {
			browser = "Edge"
		} else if strings.Contains(last, "Opera") {
			browser = "Opera"
		}
		ip := r.RemoteAddr
		clickedUrl := r.URL.Path
		userID := r.Context().Value(ClaimsKey).(*Claims).UserID
		activity := models.UserActivity{
			Ip:          ip,
			Device:      arch,
			Platform:    os,
			BrowserName: browser,
			UserID:      userID,
			ClickedUrl:  clickedUrl,
		}
		if err := srv.Db.CreateActivityForUser(&activity); err != nil {
			srv.LogError("Error creating user activity: " + err.Error())
			srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		}
		next.ServeHTTP(w, r.WithContext(r.Context()))
	})
}

func (srv *Server) handleGetAllUserActivities(w http.ResponseWriter, r *http.Request) {
	page, perPage := srv.GetPaginationInfo(r)
	search := r.URL.Query().Get("search")
	total := int64(0)
	var activities []database.UserAcitivityJoin
	err := error(nil)
	if search != "" {
		total, activities, err = srv.Db.SearchUserActivity(search, page, perPage)
		if err != nil {
			slog.Debug("Error fetching user activities: %v", err)
			srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		}
	} else {
		total, activities, err = srv.Db.GetAllUserActivity(page, perPage)
		if err != nil {
			slog.Debug("Error fetching user activities: %v", err)
			srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	pagination := models.NewPaginationInfo(page, perPage, total)
	response := models.PaginatedResource[database.UserAcitivityJoin]{
		Meta: pagination,
		Data: activities,
	}
	if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, string(err.Error()))
	}
}

func (srv *Server) handleGetUserActivityByID(w http.ResponseWriter, r *http.Request) {
	if !srv.UserIsAdmin(r) && !srv.UserIsOwner(r) {
		srv.ErrorResponse(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	page, perPage := srv.GetPaginationInfo(r)
	total, activity, err := srv.Db.GetActivityForUser(id, page, perPage)
	if err != nil {
		slog.Debug("Error fetching user activity: %v\n", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	pagination := models.NewPaginationInfo(page, perPage, total)
	response := models.PaginatedResource[models.UserActivity]{
		Meta: pagination,
		Data: activity,
	}
	if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
		slog.Debug("Error writing response: %v\n", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
	}
}
