package handlers

import (
	"Go-Prototype/backend/cmd/models"
	"encoding/json"
	"net/http"
)

func (srv *Server) registerOidcRoutes() {
	srv.Mux.HandleFunc("GET /api/oidc/clients", srv.HandleGetAllClients)
	srv.Mux.HandleFunc("POST /api/oidc/clients", srv.HandleRegisterClient)
}

func (srv *Server) HandleGetAllClients(w http.ResponseWriter, r *http.Request) {
	clients, err := srv.Db.GetAllRegisteredClients()
	if err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := srv.WriteResponse(w, http.StatusOK, clients); err != nil {
		srv.LogError(r, err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
	}
}

type RegisterClientRequest struct {
	RedirectURI        string `json:"redirect_uri"`
	ProviderPlatformID uint   `json:"provider_platform_id"`
}

func (srv *Server) HandleRegisterClient(w http.ResponseWriter, r *http.Request) {
	var client models.OidcClient
	if err := json.NewDecoder(r.Body).Decode(&client); err != nil {
		srv.LogError(r, err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := srv.Db.RegisterClient(&client); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := srv.WriteResponse(w, http.StatusCreated, client); err != nil {
		srv.LogError(r, err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
	}
}
