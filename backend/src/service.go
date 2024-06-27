package src

import (
	"UnlockEdv2/src/models"
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
			Timeout: time.Second * 20,
		},
	}
	// send initial test request with the provider ID, to see if the service exists
	test := "/"
	request := newService.Request(test)
	resp, err := newService.Client.Do(request)
	if err != nil || resp.StatusCode != http.StatusOK {
		// send the required information to the middleware to satisfy the request
		log.WithFields(log.Fields{"error": err, "status": resp.StatusCode}).Error("Error creating provider service")
		return nil, err
	}
	return &newService, nil
}

func (serv *ProviderService) Request(url string) *http.Request {
	log.Println("Init request for provider service")
	serviceKey := os.Getenv("PROVIDER_SERVICE_KEY")
	finalUrl := serv.ServiceURL + url + "?id=" + strconv.Itoa(int(serv.ProviderPlatformID))
	log.Printf("url: %s \n", finalUrl)
	request, err := http.NewRequest("GET", finalUrl, nil)
	if err != nil {
		log.Printf("error creating request %v", err.Error())
	}
	request.Header.Set("Authorization", serviceKey)
	log.Printf("request: %v", request)
	return request
}

func (serv *ProviderService) GetUsers() ([]models.ImportUser, error) {
	req := serv.Request("/api/users")
	resp, err := serv.Client.Do(req)
	if err != nil {
		log.Printf("error getting users Client.Do(req): %v", err.Error())
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		log.Errorln("request failed: with code", resp.Status)
		return nil, errors.New("request failed")
	}
	var users []models.ImportUser
	err = json.NewDecoder(resp.Body).Decode(&users)
	if err != nil {
		log.Errorln("error decoding users: ", err.Error())
		return nil, err
	}
	return users, nil
}

func (serv *ProviderService) GetPrograms() error {
	req := serv.Request("/api/programs")
	resp, err := serv.Client.Do(req)
	if err != nil {
		log.Printf("error getting content Client.Do(req): %v", err.Error())
		return err
	}
	if resp.StatusCode != http.StatusOK {
		log.WithFields(log.Fields{"handler": "GetPrograms", "status": resp.StatusCode}).Error("Failed to get programs")
		return errors.New("failed to get programs")
	}
	return nil
}

func (serv *ProviderService) GetMilestonesForProgramUser(programID, userID string) error {
	req := serv.Request("/api/users/" + userID + "/programs/" + programID + "/milestones")
	resp, err := serv.Client.Do(req)
	if err != nil {
		log.WithFields(log.Fields{"handler": "GetMilestonesForProgramUser", "UserID": userID, "error": err.Error()}).Error("Failed to get milestones for program user")
		return err
	}
	if resp.StatusCode != http.StatusOK {
		log.WithFields(log.Fields{"handler": "GetMilestonesForProgramUser", "UserID": userID, "status": resp.StatusCode}).Error("Failed to get milestones for program user")
		return errors.New("Failed to get milestones for program user")
	}
	return nil
}

func (serv *ProviderService) GetActivityForProgram(programID string) error {
	req := serv.Request("/api/programs/" + programID + "/activity")
	resp, err := serv.Client.Do(req)
	if err != nil {
		log.Printf("error getting activity Client.Do(req): %v", err.Error())
		return err
	}
	if err != nil {
		log.WithFields(log.Fields{"handler": "GetActivityForProgram", "error": err.Error()}).Error("Failed to get activity for program")
		return err
	}
	if resp.StatusCode != http.StatusOK {
		log.WithFields(log.Fields{"handler": "GetActivityForProgram", "status": resp.StatusCode}).Error("Failed to get activity for program")
		return errors.New("Failed to get milestones for program user")
	}
	return nil
}
