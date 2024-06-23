package src

import (
	"UnlockEdv2/src/models"
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	log "github.com/sirupsen/logrus"
)

/**
 * This ProviderService will interact with our middleware
 * and be completely agnostic to the provider platform we are dealing with.
 **/
type ProviderService struct {
	ProviderPlatformID uint         `json:"id"`
	Type               string       `json:"type"`
	AccountID          string       `json:"account_id"`
	BaseUrl            string       `json:"base_url"`
	ApiKey             string       `json:"api_key"`
	Username           string       `json:"username"`
	Password           string       `json:"password"`
	Client             *http.Client `json:"-"`
	ServiceURL         string       `json:"-"`
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
		BaseUrl:            prov.BaseUrl,
		AccountID:          prov.AccountID,
		ApiKey:             prov.AccessKey,
		Username:           username,
		Password:           password,
		Type:               string(prov.Type),
		ServiceURL:         serviceUrl,
		Client: &http.Client{
			Timeout: time.Second * 10,
		},
	}
	// send initial test request with the provider ID, to see if the service exists
	test := "/"
	request := newService.Request(test)
	resp, err := newService.Client.Do(request)
	if err != nil || resp.StatusCode != http.StatusOK {
		// send the required information to the middleware to satisfy the request
		return syncProviderService(&newService)
	}
	return &newService, nil
}

func syncProviderService(newService *ProviderService) (*ProviderService, error) {
	// we need to create the provider in the middleware
	log.Infof("Creating provider service")
	logFields := log.Fields{
		"providerId": newService.ProviderPlatformID,
	}
	jsonBody, jsonErr := json.Marshal(newService)
	if jsonErr != nil {
		log.WithFields(logFields).Errorf("Error marshalling body %s", jsonErr)
		return nil, jsonErr
	}
	request, err := http.NewRequest("POST", newService.ServiceURL+"/api/add-provider", bytes.NewBuffer(jsonBody))
	if err != nil {
		log.WithFields(logFields).Errorf("Error creating request %v", err.Error())
		return nil, err
	}
	request.Header.Set("Authorization", os.Getenv("PROVIDER_SERVICE_KEY"))
	request.Header.Set("Content-Type", "application/json")
	response, err := newService.Client.Do(request)
	if err != nil {
		log.WithFields(logFields).Errorf("Error sending request for provider service: %v", err.Error())
		return nil, err
	}
	if response.StatusCode != http.StatusOK && response.StatusCode != http.StatusCreated {
		log.WithFields(logFields).Errorf("Bad response when creating provider service: %v", response.Status)
		return nil, err
	}
	log.Infof("Provider service created")
	return newService, nil
}

func (serv *ProviderService) Request(url string) *http.Request {
	log.Info("Init request for provider service")
	serviceKey := os.Getenv("PROVIDER_SERVICE_KEY")
	finalUrl := serv.ServiceURL + url + "?id=" + strconv.Itoa(int(serv.ProviderPlatformID))
	request, err := http.NewRequest("GET", finalUrl, nil)
	if err != nil {
		log.WithFields(log.Fields{
			"providerId": serv.ProviderPlatformID,
		}).Errorf("Error creating request %v", err.Error())
	}
	request.Header.Set("Authorization", serviceKey)
	log.Debugf("Request created: %v", finalUrl)
	return request
}

func (serv *ProviderService) GetUsers() ([]models.ImportUser, error) {
	logFields := log.Fields{
		"providerId": serv.ProviderPlatformID,
	}
	req := serv.Request("/api/users")
	resp, err := serv.Client.Do(req)
	if err != nil {
		log.WithFields(logFields).Errorf("Error requesting users: %v", err.Error())
		return nil, err
	}
	defer resp.Body.Close()
	var users []models.ImportUser
	err = json.NewDecoder(resp.Body).Decode(&users)
	if err != nil {
		log.WithFields(logFields).Errorf("Error decoding JSON for users: %v", err.Error())
		return nil, err
	}
	return users, nil
}

func (serv *ProviderService) GetPrograms() ([]models.ImportProgram, error) {
	logFields := log.Fields{
		"providerId": serv.ProviderPlatformID,
	}
	req := serv.Request("/api/programs")
	resp, err := serv.Client.Do(req)
	if err != nil {
		log.WithFields(logFields).Errorf("Error requesting programs: %v", err.Error())
		return nil, err
	}
	defer resp.Body.Close()
	var content []models.ImportProgram
	err = json.NewDecoder(resp.Body).Decode(&content)
	if err != nil {
		log.WithFields(logFields).Errorf("Error decoding JSON for programs: %v", err.Error())
		return nil, err
	}
	return content, nil
}

func (serv *ProviderService) GetMilestonesForProgramUser(programID, userID string) ([]models.ImportMilestone, error) {
	logFields := log.Fields{
		"platformId": serv.ProviderPlatformID,
		"programId":  programID,
		"userId":     userID,
	}
	req := serv.Request("/api/users/" + userID + "/programs/" + programID + "/milestones")
	resp, err := serv.Client.Do(req)
	if err != nil {
		log.WithFields(logFields).Errorf("Error requesting milestones: %v", err.Error())
		return nil, err
	}
	defer resp.Body.Close()
	var milestones []models.ImportMilestone
	log.Debugf("response: %v", resp.Body)
	err = json.NewDecoder(resp.Body).Decode(&milestones)
	if err != nil {
		log.WithFields(logFields).Errorf("Error decoding JSON for milestones: %v", err.Error())
		return nil, err
	}
	return milestones, nil
}

func (serv *ProviderService) GetActivityForProgram(programID string) ([]models.ImportActivity, error) {
	logFields := log.Fields{
		"platformId": serv.ProviderPlatformID,
		"programId":  programID,
	}
	req := serv.Request("/api/programs/" + programID + "/activity")
	resp, err := serv.Client.Do(req)
	if err != nil {
		log.WithFields(logFields).Errorf("Error requesting activity: %v", err.Error())
		return nil, err
	}
	defer resp.Body.Close()
	var activities []models.ImportActivity
	err = json.NewDecoder(resp.Body).Decode(&activities)
	if err != nil {
		log.WithFields(logFields).Errorf("Error decoding activities: %v", err.Error())
		return nil, err
	}
	return activities, nil
}
