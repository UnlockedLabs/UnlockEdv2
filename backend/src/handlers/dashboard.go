package handlers

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerDashboardRoutes() {
	srv.Mux.Handle("GET /api/users/{id}/dashboard", srv.applyMiddleware(http.HandlerFunc(srv.HandleUserDashboard)))
	srv.Mux.Handle("GET /api/users/{id}/catalogue", srv.applyMiddleware(http.HandlerFunc(srv.HandleUserCatalogue)))
}

func (srv *Server) HandleUserDashboard(w http.ResponseWriter, r *http.Request) {
	userId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Errorf("Error parsing user ID: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	userDashboard, err := srv.Db.GetUserDashboardInfo(userId)
	if err != nil {
		log.Errorf("Error getting user dashboard info: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	response := models.Resource[models.UserDashboardJoin]{Message: "successfully retrieved users dashboard info"}
	response.Data = append(response.Data, userDashboard)
	if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
		log.Errorf("user dashboard endpoint: error writing response: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
}

/**
* GET: /api/users/{id}/catalogue
* @Query Params:
* tag: any number of tags to filter by
* ?tag=some_tag&tag=another_tag
* provider_id: provider id to filter by
**/
func (srv *Server) HandleUserCatalogue(w http.ResponseWriter, r *http.Request) {
	userId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Errorf("Error parsing user ID: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	tags := r.URL.Query()["tags"]
	userCatalogue, err := srv.Db.GetUserCatalogue(userId, tags)
	if err != nil {
		log.Errorf("Error getting user catalogue info: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	response := models.Resource[database.UserCatalogueJoin]{Message: "successfully retrieved users catalogue info", Data: userCatalogue}
	if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
		log.Errorf("user catalogue endpoint: error writing response: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
}
