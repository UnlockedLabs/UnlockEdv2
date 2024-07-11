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
	srv.Mux.HandleFunc("GET /api/oidc/clients/{id}", srv.handleGetOidcClient)
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
	srv.WriteResponse(w, http.StatusOK, response)
}

type RegisterClientRequest struct {
	RedirectURI        string `json:"redirect_uri"`
	ProviderPlatformID uint   `json:"provider_platform_id"`
	AutoRegister       bool   `json:"auto_register"`
}

func (srv *Server) handleGetOidcClient(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "handleGetOidcClient"}
	id := r.PathValue("id")
	fields["oidc_id"] = id
	var client models.OidcClient
	if err := srv.Db.Conn.Find(&client, "id = ?", id).Error; err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Errorln("error finding oidc client")
		srv.ErrorResponse(w, http.StatusBadRequest, "OIDC client info not found")
		return
	}
	resp := models.Resource[models.OidcClient]{
		Message: "Client found",
		Data:    []models.OidcClient{client},
	}
	srv.WriteResponse(w, http.StatusOK, resp)
}

func (srv *Server) HandleRegisterClient(w http.ResponseWriter, r *http.Request) {
	request := RegisterClientRequest{}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		log.Error("error decoding body: register oidc client", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	provider, err := srv.Db.GetProviderPlatformByID(int(request.ProviderPlatformID))
	if err != nil {
		log.Error("no provider platform found with that ID", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
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
		return
	}
	response := models.Resource[models.ClientResponse]{}
	resp := models.ClientResponse{
		ClientID:     client.ClientID,
		ClientSecret: client.ClientSecret,
		// our rev proxy will always redirect these requests, so we use app_url
		AuthEndpoint:  os.Getenv("APP_URL") + "/oauth2/auth",
		TokenEndpoint: os.Getenv("APP_URL") + "/oauth2/token",
		Scopes:        client.Scopes,
	}
	response.Data = append(response.Data, resp)
	if request.AutoRegister {
		response.Message = "Client successfully created and registered with the provider"
	} else {
		response.Message = "Client successfully created"
	}
	srv.WriteResponse(w, http.StatusCreated, response)
}
