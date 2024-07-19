package handlers

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"net/http"
	"strconv"
	"strings"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerUserActivityRoutes() {
	srv.Mux.Handle("GET /api/users/activity-log", srv.ApplyAdminMiddleware(srv.handleGetAllUserActivities))
	srv.Mux.Handle("GET /api/users/{id}/activity-log", srv.applyMiddleware(srv.handleGetUserActivityByID))
}

func (srv *Server) UserActivityMiddleware(next func(http.ResponseWriter, *http.Request)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userAgent := r.Header.Get("User-Agent")
		if userAgent == "" {
			userAgent = "Unknown; Unknown"
		}
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
		last := split[uint(len(split)-1)]

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
			log.Error("Error creating user activity: " + err.Error())
			srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		}
		http.HandlerFunc(next).ServeHTTP(w, r.WithContext(r.Context()))
	})
}

func (srv *Server) handleGetAllUserActivities(w http.ResponseWriter, r *http.Request) {
	page, perPage := srv.GetPaginationInfo(r)
	search := r.URL.Query().Get("search")
	search = strings.ToLower(search)
	search = strings.TrimSpace(search)
	order := strings.ToLower(r.URL.Query().Get("sort"))
	total := int64(0)
	var activities []database.UserAcitivityJoin
	err := error(nil)
	if search != "" {
		total, activities, err = srv.Db.SearchUserActivity(search, order, page, perPage)
		if err != nil {
			log.Debug("Error fetching user activities: ", err)
			srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
			return
		}
	} else {
		total, activities, err = srv.Db.GetAllUserActivity(order, page, perPage)
		if err != nil {
			log.Debug("Error fetching user activities: ", err)
			srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	pagination := models.NewPaginationInfo(page, perPage, total)
	response := models.PaginatedResource[database.UserAcitivityJoin]{
		Meta: pagination,
		Data: activities,
	}
	srv.WriteResponse(w, http.StatusOK, response)
}

func (srv *Server) handleGetUserActivityByID(w http.ResponseWriter, r *http.Request) {
	if !srv.canViewUserData(r) {
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
		log.Debug("Error fetching user activity: ", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	pagination := models.NewPaginationInfo(page, perPage, total)
	response := models.PaginatedResource[models.UserActivity]{
		Meta: pagination,
		Data: activity,
	}
	srv.WriteResponse(w, http.StatusOK, response)
}
