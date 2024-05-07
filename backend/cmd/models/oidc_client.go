package models

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"strings"
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
	headers["Accept"] = "application/json"
	headers["Content-Type"] = "application/json"

	body := map[string]interface{}{}
	body["client_name"] = prov.Name
	body["redirect_uris"] = []string{redirectURI}
	body["scopes"] = DefaultScopes
	body["acces_token_strategy"] = "opaque"
	body["allowed_cors_origins"] = []string{"*"}
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
	req, err := http.NewRequest("POST", os.Getenv("OIDC_SERVER_URL")+"/admin/clients", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, err
	}
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var clientData map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&clientData)
	if err != nil {
		return nil, err
	}
	oidcClient := &OidcClient{
		ProviderPlatformID: prov.ID,
		ClientID:           clientData["client_id"].(string),
		ClientName:         clientData["client_name"].(string),
		ClientSecret:       clientData["client_secret"].(string),
		RedirectURIs:       strings.Join(clientData["redirect_uris"].([]string), ","),
		Scopes:             strings.Join(clientData["scope"].([]string), " "),
	}
	return oidcClient, nil
}
