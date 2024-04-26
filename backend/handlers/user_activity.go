package handlers

import (
	"backend/models"
	"log"
	"net/http"
	"strconv"
	"strings"
)

func (srv *Server) UserActivityMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userAgent := r.Header.Get("User-Agent")
		if userAgent == "" {
			userAgent = "Unknown; Unknown"
		}
		log.Printf("User-Agent: %s\n", userAgent)
		// Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0
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
			srv.Logger.Printf("Error creating user activity: %v\n", err)
			srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		}
		next.ServeHTTP(w, r)
	})
}

func (srv *Server) GetAllUserActivities(w http.ResponseWriter, r *http.Request) {
	page, perPage := srv.GetPaginationInfo(r)
	total, activites, err := srv.Db.GetAllUserActivity(page, perPage)
	if err != nil {
		srv.Logger.Printf("Error fetching user activities: %v\n", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	pagination := models.NewPaginationInfo(page, perPage, total)
	response := models.PaginatedResource[models.UserActivity]{
		Meta: pagination,
		Data: activites,
	}
	if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, string(err.Error()))
	}
}

func (srv *Server) GetUserActivityByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	page, perPage := srv.GetPaginationInfo(r)
	total, activity, err := srv.Db.GetActivityForUser(id, page, perPage)
	if err != nil {
		srv.Logger.Printf("Error fetching user activity: %v\n", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	pagination := models.NewPaginationInfo(page, perPage, total)
	response := models.PaginatedResource[models.UserActivity]{
		Meta: pagination,
		Data: activity,
	}
	if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
		srv.Logger.Printf("Error writing response: %v\n", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
	}
}
