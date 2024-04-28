package handlers

import (
	"Go-Prototype/backend/cmd"
	"Go-Prototype/backend/cmd/models"
	"net/http"
	"strconv"
)

func (srv *Server) RegisterActionsRoutes() {
	srv.Mux.Handle("POST /actions/provider-platforms/{id}/import-users", srv.ApplyMiddleware(http.HandlerFunc(srv.ImportUsers)))
}

func (srv *Server) ImportUsers(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	provider, err := srv.Db.GetProviderPlatformByID(id)
	if err != nil {
		srv.LogError("Error getting provider platform by ID:" + err.Error())
		srv.ErrorResponse(w, http.StatusNotFound, err.Error())
		return
	}
	service, err := cmd.GetProviderService(provider)
	if err != nil {
		srv.LogError("Error getting provider service GetProviderService():" + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	users, err := service.GetUsers()
	if err != nil {
		srv.LogError("Error getting provider service GetUsers():" + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	for _, user := range users {
		if user.Username == "" && user.Email == "" && user.NameLast == "" {
			continue
		}
		created, err := srv.Db.CreateUser(&user)
		if err != nil {
			srv.LogError("Error creating user:" + err.Error())
			continue
		}
		mapping := models.ProviderUserMapping{
			UserID:             created.ID,
			ProviderPlatformID: provider.ID,
			ExternalUsername:   user.Username,
		}
		if err = srv.Db.CreateProviderUserMapping(&mapping); err != nil {
			srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	w.WriteHeader(http.StatusCreated)
}

func (srv *Server) ImportContent(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	provider, err := srv.Db.GetProviderPlatformByID(id)
	if err != nil {
		srv.ErrorResponse(w, http.StatusNotFound, err.Error())
		return
	}
	service, err := cmd.GetProviderService(provider)
	if err != nil {
		srv.LogError("Error getting provider service GetProviderService():" + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	content, err := service.GetContent()
	if err != nil {
		srv.LogError("Error getting provider service GetContent():" + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	for _, item := range content {
		if item.Name == "" && item.Description == "" {
			continue
		}
		_, err := srv.Db.CreateContent(&item)
		if err != nil {
			srv.LogError("Error creating content:" + err.Error())
			continue
		}
		return
	}
	if err := srv.WriteResponse(w, http.StatusOK, "Successfully imported courses"); err != nil {
		srv.LogError("Error writing response:" + err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
}
