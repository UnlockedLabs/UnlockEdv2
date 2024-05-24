package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"os"

	log "github.com/sirupsen/logrus"
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
	response := models.Resource[models.OidcClient]{
		Data:    clients,
		Message: "Successfully fetched all registered clients",
	}
	if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
		log.Error(r, err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
	}
}

type RegisterClientRequest struct {
	RedirectURI        string `json:"redirect_uri"`
	ProviderPlatformID uint   `json:"provider_platform_id"`
	AutoRegister       bool   `json:"auto_register"`
}

func (srv *Server) HandleRegisterClient(w http.ResponseWriter, r *http.Request) {
	request := RegisterClientRequest{}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		log.Error(r, err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	provider, err := srv.Db.GetProviderPlatformByID(int(request.ProviderPlatformID))
	if err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		log.Error(r, err)
		return
	}
	if provider.OidcID != 0 || provider.ExternalAuthProviderId != "" {
		srv.ErrorResponse(w, http.StatusBadRequest, "Client already registered")
		log.Error(r, err)
		return
	}
	client, externalId, err := models.OidcClientFromProvider(provider, request.AutoRegister)
	if err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		log.Error(r, err)
		return
	}
	if err := srv.Db.RegisterClient(client); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	provider.OidcID = client.ID
	provider.ExternalAuthProviderId = externalId
	if _, err := srv.Db.UpdateProviderPlatform(provider, provider.ID); err != nil {
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		log.Error(r, err)
	}
	response := models.Resource[models.ClientResponse]{}
	resp := models.ClientResponse{
		ClientID:      client.ClientID,
		ClientSecret:  client.ClientSecret,
		AuthEndpoint:  os.Getenv("HYDRA_PUBLIC_URL") + "/oauth2/auth",
		TokenEndpoint: os.Getenv("HYDRA_PUBLIC_URL") + "/oauth2/token",
		Scopes:        client.Scopes,
	}
	response.Data = append(response.Data, resp)
	if request.AutoRegister {
		response.Message = "Client successfully created and registered with the provider"
	} else {
		response.Message = "Client successfully created"
	}
	if err := srv.WriteResponse(w, http.StatusCreated, response); err != nil {
		log.Error(r, err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
	}
}
