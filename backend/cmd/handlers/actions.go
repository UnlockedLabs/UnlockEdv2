package handlers

import (
	"backend/cmd"
	"backend/cmd/models"
	"log"
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
		srv.ErrorResponse(w, http.StatusNotFound, err.Error())
		return
	}
	log.Printf("LOGGING PROVIDER: %v \n", provider)
	log.Println("Getting provider service")
	service, err := cmd.GetProviderService(&provider)
	if err != nil {
		srv.Logger.Printf("Error getting provider service GetProviderService(): %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	users, err := service.GetUsers()
	if err != nil {
		srv.Logger.Printf("Error getting provider service GetUsers(): %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	for _, user := range users {
		if user.Username == "" && user.Email == "" && user.NameLast == "" {
			continue
		}
		created, err := srv.Db.CreateUser(&user)
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
