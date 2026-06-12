package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
)

func (srv *Server) registerOidcRoutes() []routeDef {
	axx := models.ProviderAccess
	return []routeDef{
		adminFeatureRoute("GET /api/oidc/clients", srv.handleGetAllClients, axx),
		adminFeatureRoute("POST /api/oidc/clients", srv.handleRegisterClient, axx),
		adminFeatureRoute("GET /api/oidc/clients/{id}", srv.handleGetOidcClient, axx),
		adminFeatureRoute("POST /api/oidc/clients/{id}/recreate", srv.handleRecreateClient, axx),
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

func clientToResponse(client *models.OidcClient) *models.ClientResponse {
	return &models.ClientResponse{
		ClientID:      client.ClientID,
		ClientSecret:  client.ClientSecret,
		AuthEndpoint:  os.Getenv("APP_URL") + "/oauth2/auth",
		TokenEndpoint: os.Getenv("APP_URL") + "/oauth2/token",
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
	return writeJsonResponse(w, http.StatusOK, *clientToResponse(client))
}

func (srv *Server) handleRecreateClient(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "oidc client ID")
	}
	log.add("oidc_client_id", id)
	existing, err := srv.Db.GetOidcClientById(fmt.Sprintf("%d", id))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	provider, err := srv.Db.GetProviderPlatformByID(int(existing.ProviderPlatformID))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	// delete from Hydra
	hydraReq, err := http.NewRequest("DELETE", os.Getenv("HYDRA_ADMIN_URL")+"/admin/clients/"+existing.ClientID, nil)
	if err == nil {
		hydraReq.Header.Set("Authorization", "Bearer "+os.Getenv("ORY_TOKEN"))
		resp, doErr := srv.Client.Do(hydraReq)
		if doErr == nil {
			defer func() { _ = resp.Body.Close() }()
		}
	}
	if err := srv.Db.DeleteOidcClient(existing.ID); err != nil {
		return newDatabaseServiceError(err)
	}
	provider.ExternalAuthProviderId = ""
	if _, err := srv.Db.UpdateProviderPlatform(provider, provider.ID); err != nil {
		return newDatabaseServiceError(err)
	}
	newClient, externalId, err := models.OidcClientFromProvider(provider, true, srv.Client)
	if err != nil {
		return newInternalServerServiceError(err, err.Error())
	}
	if err := srv.Db.RegisterClient(newClient); err != nil {
		return newDatabaseServiceError(err)
	}
	provider.ExternalAuthProviderId = externalId
	if _, err := srv.Db.UpdateProviderPlatform(provider, provider.ID); err != nil {
		log.add("clientId", newClient.ID)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, *clientToResponse(newClient))
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
	client, externalId, err := models.OidcClientFromProvider(provider, request.AutoRegister, srv.Client)
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
	return writeJsonResponse(w, http.StatusCreated, *clientToResponse(client))
}
