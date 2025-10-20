package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"net/http"
)

func (srv *Server) registerOidcRoutes() []routeDef {
	axx := models.ProviderAccess
	return []routeDef{
		adminFeatureRoute("GET /api/oidc/clients", srv.handleGetAllClients, axx),
		adminFeatureRoute("POST /api/oidc/clients", srv.handleRegisterClient, axx),
		adminFeatureRoute("GET /api/oidc/clients/{id}", srv.handleGetOidcClient, axx),
	}
}

func (srv *Server) handleGetAllClients(w http.ResponseWriter, r *http.Request, log sLog) error {
	clients, err := srv.Db.GetAllRegisteredClients()
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, clients)
}

type RegisterClientRequest struct {
	RedirectURI        string `json:"redirect_uri"`
	ProviderPlatformID uint   `json:"provider_platform_id"`
	AutoRegister       bool   `json:"auto_register"`
}

func clientToResponse(client *models.OidcClient, appURL string) *models.ClientResponse {
	return &models.ClientResponse{
		ClientID:      client.ClientID,
		ClientSecret:  client.ClientSecret,
		AuthEndpoint:  appURL + "/oauth2/auth",
		TokenEndpoint: appURL + "/oauth2/token",
		Scopes:        client.Scopes,
	}
}

func (srv *Server) handleGetOidcClient(w http.ResponseWriter, r *http.Request, log sLog) error {
	id := r.PathValue("id")
	log.add("oidc_id", id)
	client, err := srv.Db.GetOidcClientById(id)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, *clientToResponse(client, srv.config.AppURL))
}

func (srv *Server) handleRegisterClient(w http.ResponseWriter, r *http.Request, log sLog) error {
	request := RegisterClientRequest{}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	provider, err := srv.Db.GetProviderPlatformByID(int(request.ProviderPlatformID))
	log.add("providerPlatformId", request.ProviderPlatformID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if provider.OidcID != 0 || provider.ExternalAuthProviderId != "" {
		return newBadRequestServiceError(errors.New("client already registered"), "Client already registered")
	}
	client, externalId, err := models.OidcClientFromProvider(provider, request.AutoRegister, srv.Client, srv.config.AppURL, srv.config.OryToken, srv.config.HydraPublicURL, srv.config.HydraAdminURL)
	if err != nil {
		return newInternalServerServiceError(err, err.Error())
	}
	log.add("externalId", externalId)
	if err := srv.Db.RegisterClient(client); err != nil {
		return newDatabaseServiceError(err)
	}
	provider.ExternalAuthProviderId = externalId
	if _, err := srv.Db.UpdateProviderPlatform(provider, provider.ID); err != nil {
		log.add("clientId", client.ID)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, *clientToResponse(client, srv.config.AppURL))
}
