package models

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
)

type OidcClient struct {
	DatabaseFields
	ProviderPlatformID uint   `json:"provider_platform_id"`
	ClientID           string `gorm:"size:255" json:"client_id"`
	ClientName         string `gorm:"size:255" json:"client_name"`
	ClientSecret       string `gorm:"size:255" json:"client_secret"`
	RedirectURIs       string `gorm:"size:255" json:"redirect_uris"`
	Scopes             string `gorm:"size:255" json:"scopes"`

	Provider *ProviderPlatform `gorm:"foreignKey:ProviderPlatformID" json:"-"`
}

const DefaultScopes = "openid profile email"

func (OidcClient) TableName() string {
	return "oidc_clients"
}

func OidcClientFromProvider(prov *ProviderPlatform) (*OidcClient, error) {
	redirectURI := prov.GetDefaultRedirectURI()
	client := http.Client{}
	headers := map[string]string{}
	headers["Authorization"] = "Bearer " + os.Getenv("HYDRA_ADMIN_TOKEN")
	headers["Origin"] = os.Getenv("APP_URL")
	body := map[string]interface{}{}
	body["client_name"] = prov.Name
	body["redirect_uris"] = []string{redirectURI}
	body["scopes"] = DefaultScopes
	body["acces_token_strategy"] = "opaque"
	body["metadata"] = map[string]interface{}{
		"Origin": os.Getenv("APP_URL"),
	}
	body["allowed_cors_origins"] = []string{os.Getenv("HYDRA_ADMIN_URL"), os.Getenv("APP_URL"), os.Getenv("FRONTEND_URL"), os.Getenv("HYDRA_PUBLIC_URL")}
	body["grant_types"] = []string{"authorization_code"}
	body["authorization_code_grant_access_token_lifespan"] = "3h"
	body["authorization_code_grant_id_token_lifespan"] = "3h"
	body["authorization_code_grant_refresh_token_lifespan"] = "3h"
	body["skip_consent"] = false
	body["skip_logout_consent"] = true
	body["token_endpoint_auth_method"] = "client_secret_basic"
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest("POST", os.Getenv("HYDRA_ADMIN_URL")+"/admin/clients", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, err
	}
	req.Header.Add("Authorization", headers["Authorization"])
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("error creating client: %s", resp.Status)
	}
	var clientData map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&clientData)
	if err != nil {
		return nil, err
	}
	if clientData == nil {
		return nil, fmt.Errorf("error creating client: %s", resp.Status)
	}
	redirects := clientData["redirect_uris"].([]interface{})
	if len(redirects) == 0 {
		return nil, fmt.Errorf("error creating client: no redirect URIs")
	}
	receivedURI := redirects[0].(string)
	if receivedURI != redirectURI {
		return nil, fmt.Errorf("error creating client: redirect URI mismatch")
	}
	oidcClient := &OidcClient{
		ProviderPlatformID: prov.ID,
		ClientID:           clientData["client_id"].(string),
		ClientName:         clientData["client_name"].(string),
		ClientSecret:       clientData["client_secret"].(string),
		RedirectURIs:       receivedURI,
		Scopes:             clientData["scope"].(string),
	}
	if prov.Type == CanvasCloud || prov.Type == CanvasOSS {
		// register the login client with canvas
		baseURL := prov.BaseUrl + "/api/v1/accounts/" + prov.AccountID + "/authentication_providers"
		// we need to add the client_id, client_secret, and redirect_uri to the request form encoded
		form := url.Values{}
		form.Add("auth_type", "openid_connect")
		form.Add("client_id", oidcClient.ClientID)
		form.Add("client_secret", oidcClient.ClientSecret)
		form.Add("authorize_url", os.Getenv("HYDRA_PUBLIC_URL")+"/oauth2/auth")
		form.Add("token_url", os.Getenv("HYDRA_PUBLIC_URL")+"/oauth2/auth")
		form.Add("userinfo_endpoint", os.Getenv("HYDRA_PUBLIC_URL")+"/userinfo")
		request, err := http.NewRequest("POST", baseURL, bytes.NewBufferString(form.Encode()))
		if err != nil {
			log.Println("Error creating request object: ", err)
			return oidcClient, err
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
			return oidcClient, err
		}
		defer response.Body.Close()
		if response.StatusCode != http.StatusCreated && response.StatusCode != http.StatusOK {
			log.Println("Error creating authentication provider: ", response.Status)
			return oidcClient, fmt.Errorf("error creating authentication provider: %v", response)
		}
	}
	return oidcClient, nil
}

/*
* {
  "access_token_strategy": "string",
  "allowed_cors_origins": [
    "string"
  ],
  "audience": [
    "string"
  ],
  "authorization_code_grant_access_token_lifespan": "string",
  "authorization_code_grant_id_token_lifespan": "string",
  "authorization_code_grant_refresh_token_lifespan": "string",
  "backchannel_logout_session_required": true,
  "backchannel_logout_uri": "string",
  "client_credentials_grant_access_token_lifespan": "string",
  "client_id": "string",
  "client_name": "string",
  "client_secret": "string",
  "client_secret_expires_at": 0,
  "client_uri": "string",
  "contacts": [
    "string"
  ],
  "created_at": "2019-08-24T14:15:22Z",
  "frontchannel_logout_session_required": true,
  "frontchannel_logout_uri": "string",
  "grant_types": [
    "string"
  ],
  "implicit_grant_access_token_lifespan": "string",
  "implicit_grant_id_token_lifespan": "string",
  "jwks": null,
  "jwks_uri": "string",
  "jwt_bearer_grant_access_token_lifespan": "string",
  "logo_uri": "string",
  "metadata": {},
  "owner": "string",
  "policy_uri": "string",
  "post_logout_redirect_uris": [
    "string"
  ],
  "redirect_uris": [
    "string"
  ],
  "refresh_token_grant_access_token_lifespan": "string",
  "refresh_token_grant_id_token_lifespan": "string",
  "refresh_token_grant_refresh_token_lifespan": "string",
  "registration_access_token": "string",
  "registration_client_uri": "string",
  "request_object_signing_alg": "string",
  "request_uris": [
    "string"
  ],
  "response_types": [
    "string"
  ],
  "scope": "scope1 scope-2 scope.3 scope:4",
  "sector_identifier_uri": "string",
  "skip_consent": true,
  "skip_logout_consent": true,
  "subject_type": "string",
  "token_endpoint_auth_method": "client_secret_basic",
  "token_endpoint_auth_signing_alg": "string",
  "tos_uri": "string",
  "updated_at": "2019-08-24T14:15:22Z",
  "userinfo_signed_response_alg": "string"
}
*/
