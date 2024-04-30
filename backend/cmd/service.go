package cmd

import (
	"Go-Prototype/backend/cmd/models"
	"bytes"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
)

/**
 * This ProviderService will interact with our middleware
 * and be completely agnostic to the provider platform we are dealing with.
 **/
type ProviderService struct {
	ProviderPlatformID int          `json:"id"`
	Type               string       `json:"type"`
	AccountID          string       `json:"account_id"`
	Url                string       `json:"url"`
	ApiKey             string       `json:"api_key"`
	Username           string       `json:"username"`
	Password           string       `json:"password"`
	Client             *http.Client `json:"-"`
}

func GetProviderService(prov *models.ProviderPlatform) (*ProviderService, error) {
	serviceUrl := os.Getenv("PROVIDER_SERVICE_URL")
	// If the provider is Kolibri, we need to split the key into username and password
	// In the future, we will need to have similar fields for Oauth2 retrieval from canvas
	username, password := "", ""
	if prov.Type == models.Kolibri {
		if strings.Contains(prov.AccessKey, ":") {
			username, password = strings.Split(prov.AccessKey, ":")[0], strings.Split(prov.AccessKey, ":")[1]
		} else {
			return nil, errors.New("invalid access key for Kolibri. must be in the format username:password")
		}
	}
	newService := ProviderService{
		ProviderPlatformID: prov.ID,
		Client:             &http.Client{},
		Url:                prov.BaseUrl,
		AccountID:          prov.AccountID,
		ApiKey:             prov.AccessKey,
		Username:           username,
		Password:           password,
		Type:               string(prov.Type),
	}
	// send initial test request with the provider ID, to see if the service exists
	test := "/"
	request := newService.Request(test)
	resp, err := newService.Client.Do(request)
	if err != nil || resp.StatusCode != http.StatusOK {
		// we need to create the provider in the middleware
		// marshal the provider struct into json, and send it to the service
		log.Println("Creating provider service !!!")
		jsonBody, jsonErr := json.Marshal(newService)
		if jsonErr != nil {
			log.Printf("Error marshalling provider %s", jsonErr)
			return nil, err
		}
		log.Printf("err: %v", err)
		newService.Url = serviceUrl
		request, err = http.NewRequest("POST", serviceUrl+"/api/add-provider", bytes.NewBuffer(jsonBody))
		if err != nil {
			log.Printf("error creating provider service: %v", err.Error())
			return nil, err
		}
		request.Header.Set("Authorization", os.Getenv("PROVIDER_SERVICE_KEY"))
		request.Header.Set("Content-Type", "application/json")
		response, err := newService.Client.Do(request)
		if err != nil {
			log.Printf("error creating provider service: %v", err.Error())
			return nil, err
		}
		if response.StatusCode != http.StatusOK && response.StatusCode != http.StatusCreated {
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
	servUrl := os.Getenv("PROVIDER_SERVICE_URL")
	finalUrl := servUrl + url + "?id=" + strconv.Itoa(serv.ProviderPlatformID)
	log.Printf("url: %s \n", finalUrl)
	request, err := http.NewRequest("GET", finalUrl, nil)
	if err != nil {
		log.Printf("error getting users: %v", err.Error())
	}
	request.Header.Set("Authorization", serviceKey)
	log.Printf("request: %v", request)
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

func (serv *ProviderService) GetPrograms() ([]models.Program, error) {
	req := serv.Request("/api/programs")
	resp, err := serv.Client.Do(req)
	if err != nil {
		log.Printf("error getting content Client.Do(req): %v", err.Error())
		return make([]models.Program, 0), err
	}
	defer resp.Body.Close()
	var content []models.Program
	log.Printf("response: %v", resp.Body)
	err = json.NewDecoder(resp.Body).Decode(&content)
	if err != nil {
		log.Printf("error decoding content: %v", err.Error())
		return make([]models.Program, 0), err
	}
	return content, nil
}
