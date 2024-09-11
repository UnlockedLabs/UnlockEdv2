package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"net/http"
	"os"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerOidcRoutes() {
	srv.Mux.HandleFunc("GET /api/oidc/clients", srv.ApplyAdminMiddleware(srv.HandleError(srv.HandleGetAllClients)))
	srv.Mux.HandleFunc("POST /api/oidc/clients", srv.ApplyAdminMiddleware(srv.HandleError(srv.HandleRegisterClient)))
	srv.Mux.HandleFunc("GET /api/oidc/clients/{id}", srv.ApplyAdminMiddleware(srv.HandleError(srv.handleGetOidcClient)))
}

func (srv *Server) HandleGetAllClients(w http.ResponseWriter, r *http.Request) error {
	clients, err := srv.Db.GetAllRegisteredClients()
	if err != nil {
		return newDatabaseServiceError(err, nil)
	}
	return writeJsonResponse(w, http.StatusOK, clients)
}

type RegisterClientRequest struct {
	RedirectURI        string `json:"redirect_uri"`
	ProviderPlatformID uint   `json:"provider_platform_id"`
	AutoRegister       bool   `json:"auto_register"`
}

func clientToResponse(client *models.OidcClient) *models.ClientResponse {
	return &models.ClientResponse{
		ClientID:      client.ClientID,
		ClientSecret:  client.ClientSecret,
		AuthEndpoint:  os.Getenv("APP_URL") + "/oauth2/auth",
		TokenEndpoint: os.Getenv("APP_URL") + "/oauth2/token",
		Scopes:        client.Scopes,
	}
}

func (srv *Server) handleGetOidcClient(w http.ResponseWriter, r *http.Request) error {
	fields := log.Fields{"handler": "handleGetOidcClient"}
	id := r.PathValue("id")
	fields["oidc_id"] = id
	client, err := srv.Db.GetOidcClientById(id)
	if err != nil {
		fields["error"] = err.Error()
		return newDatabaseServiceError(err, fields)
	}

	return writeJsonResponse(w, http.StatusOK, *clientToResponse(client))
}

func (srv *Server) HandleRegisterClient(w http.ResponseWriter, r *http.Request) error {
	request := RegisterClientRequest{}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		return newJSONReqBodyServiceError(err, nil)
	}
	provider, err := srv.Db.GetProviderPlatformByID(int(request.ProviderPlatformID))
	if err != nil {
		return newDatabaseServiceError(err, nil)
	}
	if provider.OidcID != 0 || provider.ExternalAuthProviderId != "" {
		return newBadRequestServiceError(errors.New("client already registered"), "Client already registered", nil)
	}
	client, externalId, err := models.OidcClientFromProvider(provider, request.AutoRegister, srv.Client)
	if err != nil {
		return newInternalServerServiceError(err, err.Error(), nil)
	}
	if err := srv.Db.RegisterClient(client); err != nil {
		return newDatabaseServiceError(err, nil)
	}
	provider.OidcID = client.ID
	provider.ExternalAuthProviderId = externalId
	if _, err := srv.Db.UpdateProviderPlatform(provider, provider.ID); err != nil {
		return newDatabaseServiceError(err, nil)
	}
	return writeJsonResponse(w, http.StatusCreated, *clientToResponse(client))
}
