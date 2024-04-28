package cmd

import (
	"Go-Prototype/backend/cmd/models"
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
)

/**
 * This ProviderService will interact with our middleware
 * and be completely agnostic to the provider platform we are dealing with.
 **/
type ProviderService struct {
	Client    *http.Client                `json:"-"`
	AccountID string                      `json:"account_id"`
	Url       string                      `json:"url"`
	ApiKey    string                      `json:"api_key"`
	Username  string                      `json:"username"`
	Password  string                      `json:"password"`
	Type      models.ProviderPlatformType `json:"type"`
}

func GetProviderService(prov *models.ProviderPlatform) (*ProviderService, error) {
	serviceUrl := os.Getenv("PROVIDER_SERVICE_URL")
	// If the provider is Kolibri, we need to split the key into username and password
	// In the future, we will need to have similar fields for Oauth2 retrieval from canvas
	username, password := "", ""
	if prov.Type == models.Kolibri {
		username, password = strings.Split(prov.AccessKey, ":")[0], strings.Split(prov.AccessKey, ":")[1]
	}
	newService := ProviderService{
		Client:    &http.Client{},
		Url:       prov.BaseUrl,
		AccountID: prov.AccountID,
		ApiKey:    prov.AccessKey,
		Username:  username,
		Password:  password,
		Type:      prov.Type,
	}
	// first make sure this provider has been initiated
	request, err := http.NewRequest("GET", serviceUrl+"?facility_id="+prov.AccountID, nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Authorization", os.Getenv("PROVIDER_SERVICE_KEY"))
	request.Header.Set("Content-Type", "application/json")
	response, err := newService.Client.Do(request)

	if err != nil || response.StatusCode != http.StatusOK {
		// we need to create the provider in the middleware
		jsonBody, jsonErr := json.Marshal(prov)
		if jsonErr != nil {
			log.Printf("Error marshalling provider %s", jsonErr)
			return nil, err
		}
		log.Printf("url: %s", serviceUrl)
		newService.Url = serviceUrl
		request, err = http.NewRequest("POST", serviceUrl+"/api/add-provider", bytes.NewBuffer(jsonBody))
		if err != nil {
			log.Printf("error creating provider service: %v", err.Error())
			return nil, err
		}
		request.Header.Set("Authorization", os.Getenv("PROVIDER_SERVICE_KEY"))
		request.Header.Set("Content-Type", "application/json")
		response, err = newService.Client.Do(request)
		if err != nil {
			log.Printf("error creating provider service: %v", err.Error())
			return nil, err
		}
		if response.StatusCode != http.StatusOK {
			log.Printf("error creating provider service: %v", response.Status)
			return nil, err
		}
		log.Printf("Provider service created")
		return &newService, nil
	}
	newService.Url = serviceUrl
	return &newService, nil
}

func (serv *ProviderService) Request(url string) *http.Request {
	serviceKey := os.Getenv("PROVIDER_SERVICE_KEY")
	if serv.Url == "" {
		serv.Url = os.Getenv("PROVIDER_SERVICE_URL")
	}
	finalUrl := serv.Url + url + "?facility_id=" + serv.AccountID
	log.Printf("url: %s \n", finalUrl)
	request, err := http.NewRequest("GET", finalUrl, nil)
	if err != nil {
		log.Printf("error getting users: %v", err.Error())
	}
	request.Header.Set("Authorization", serviceKey)
	return request
}

func (serv *ProviderService) GetUsers() ([]models.User, error) {
	req := serv.Request("/api/users")
	resp, err := serv.Client.Do(req)
	if err != nil {
		log.Printf("error getting users Client.Do(req): %v", err.Error())
		return make([]models.User, 0), err
	}
	defer resp.Body.Close()
	var users []models.User
	log.Printf("response: %v", resp.Body)
	err = json.NewDecoder(resp.Body).Decode(&users)
	if err != nil {
		log.Printf("error decoding users: %v", err.Error())
		return make([]models.User, 0), err
	}
	return users, nil
}
