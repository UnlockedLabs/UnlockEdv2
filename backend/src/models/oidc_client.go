package models

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"

	log "github.com/sirupsen/logrus"
)

type OidcClient struct {
	DatabaseFields
	ProviderPlatformID uint   `json:"provider_platform_id"`
	ClientID           string `gorm:"size:255" json:"client_id"`
	ClientName         string `gorm:"size:255" json:"client_name"`
	ClientSecret       string `gorm:"size:255" json:"client_secret"`
	RedirectURIs       string `gorm:"size:255" json:"redirect_uris"`
	Scopes             string `gorm:"size:255" json:"scope"`

	Provider *ProviderPlatform `gorm:"foreignKey:ProviderPlatformID" json:"-"`
}

type ClientResponse struct {
	ClientID      string `json:"client_id"`
	ClientSecret  string `json:"client_secret"`
	Scopes        string `json:"scope"`
	AuthEndpoint  string `json:"auth_url"`
	TokenEndpoint string `json:"token_url"`
}

const DefaultScopes = "openid offline profile email"

func (OidcClient) TableName() string {
	return "oidc_clients"
}

func OidcClientFromProvider(prov *ProviderPlatform, autoRegister bool, client *http.Client) (*OidcClient, string, error) {
	externalId := ""
	redirectURI := prov.GetDefaultRedirectURI()
	headers := map[string]string{}
	headers["Authorization"] = "Bearer " + os.Getenv("ORY_TOKEN")
	headers["Origin"] = os.Getenv("APP_URL")
	body := map[string]interface{}{}
	body["client_name"] = prov.Name
	body["client_uri"] = prov.BaseUrl
	body["redirect_uris"] = redirectURI
	body["scope"] = DefaultScopes
	body["acces_token_strategy"] = "opaque"
	body["metadata"] = map[string]interface{}{
		"Origin": os.Getenv("APP_URL"),
	}
	body["response_types"] = []string{"code", "id_token", "token"}
	body["allowed_cors_origins"] = []string{os.Getenv("APP_URL"), prov.BaseUrl, os.Getenv("HYDRA_PUBLIC_URL"), "http://127.0.0.1"}
	body["grant_types"] = []string{"authorization_code", "refresh_token"}
	body["authorization_code_grant_access_token_lifespan"] = "3h"
	body["authorization_code_grant_id_token_lifespan"] = "3h"
	body["authorization_code_grant_refresh_token_lifespan"] = "3h"
	body["skip_consent"] = true
	body["skip_logout_consent"] = true
	switch prov.Type {
	case CanvasCloud, CanvasOSS:
		body["token_endpoint_auth_method"] = "client_secret_post"
		body["subject_type"] = "pairwise"
	case Kolibri:
		body["token_endpoint_auth_method"] = "client_secret_basic"
		body["subject_type"] = "public"
	}
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, externalId, err
	}
	req, err := http.NewRequest("POST", os.Getenv("HYDRA_ADMIN_URL")+"/admin/clients", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, externalId, err
	}
	req.Header.Add("Authorization", headers["Authorization"])
	resp, err := client.Do(req)
	if err != nil {
		return nil, externalId, err
	}
	defer func() {
		if resp.Body.Close() != nil {
			log.Error("Error closing response body")
		}
	}()
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return nil, externalId, fmt.Errorf("error creating client in hydra oidc server: received %s", resp.Status)
	}
	var clientData map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&clientData)
	if err != nil {
		return nil, externalId, err
	}
	if clientData == nil {
		return nil, externalId, fmt.Errorf("error creating client: %s", resp.Status)
	}
	joined := strings.Join(redirectURI, ",")
	oidcClient := &OidcClient{
		ProviderPlatformID: prov.ID,
		ClientID:           clientData["client_id"].(string),
		ClientName:         clientData["client_name"].(string),
		ClientSecret:       clientData["client_secret"].(string),
		RedirectURIs:       joined,
		Scopes:             clientData["scope"].(string),
	}
	if autoRegister && (prov.Type == CanvasCloud || prov.Type == CanvasOSS) {
		externalId, err = autoRegisterCanvas(prov, oidcClient)
		if err != nil {
			log.Error("Error auto registering provider as client: ", err)
		}
	}
	return oidcClient, externalId, nil
}

func autoRegisterCanvas(prov *ProviderPlatform, oidcClient *OidcClient) (string, error) {
	client := http.Client{}
	externalId := ""
	// register the login client with canvas
	baseURL := prov.BaseUrl + "/api/v1/accounts/" + prov.AccountID + "/authentication_providers"
	// we need to add the client_id, client_secret, and redirect_uri to the request form encoded
	form := url.Values{}
	form.Add("auth_type", "openid_connect")
	form.Add("client_id", oidcClient.ClientID)
	form.Add("client_secret", oidcClient.ClientSecret)
	form.Add("authorize_url", os.Getenv("APP_URL")+"/oauth2/auth")
	form.Add("token_url", os.Getenv("APP_URL")+"/oauth2/token")
	form.Add("userinfo_endpoint", os.Getenv("APP_URL")+"/userinfo")
	form.Add("login_attribute", "preferred_username")
	request, err := http.NewRequest("POST", baseURL, bytes.NewBufferString(form.Encode()))
	if err != nil {
		log.Println("Error creating request object: ", err)
		return "", err
	}
	log.Printf("Authorization: Bearer %s", prov.AccessKey)
	headers := make(map[string]string)
	headers["Content-Type"] = "application/x-www-form-urlencoded"
	headers["Authorization"] = "Bearer " + prov.AccessKey
	headers["Accept"] = "application/json"
	for k, v := range headers {
		request.Header.Add(k, v)
	}
	log.Printf("Request: %v", request)
	response, err := client.Do(request)
	if err != nil {
		log.Println("Error sending request: ", err)
		return "", err
	}
	defer func() {
		if response.Body.Close() != nil {
			log.Println("Error closing response body")
		}
	}()
	if response.StatusCode != http.StatusCreated && response.StatusCode != http.StatusOK {
		log.Println("Error creating authentication provider: ", response.Status)
	}
	var authProvider map[string]interface{}
	err = json.NewDecoder(response.Body).Decode(&authProvider)
	if err != nil {
		log.Error("Error decoding response body: ", err)
		return "", err
	}
	if authProvider == nil {
		log.Error("Error creating authentication provider: ", response.Status, response.Body)
		return "", err
	}
	if authProvider["id"] == nil {
		log.Error("Error creating authentication provider: no ID in response")
		return "", err
	}
	externalId = fmt.Sprintf("%d", int(authProvider["id"].(float64)))
	log.Info("new external id registered from canvas: " + externalId)
	return externalId, nil
}
