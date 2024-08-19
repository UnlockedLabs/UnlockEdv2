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
	fields := log.Fields{"handler": "GetUsers"}
	req := serv.Request("/api/users")
	resp, err := serv.Client.Do(req)
	if err != nil {
		fields["error"] = err
		log.WithFields(fields).Errorln("error getting users Client.Do(req)")
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		fields["status_code"] = resp.Status
		log.Errorln("request failed: with code", resp.Status)
		return nil, errors.New("request failed")
	}
	var users []models.ImportUser
	err = json.NewDecoder(resp.Body).Decode(&users)
	if err != nil {
		fields["error"] = err
		log.Errorln("error decoding users from middleware")
		return nil, err
	}
	log.Debugf("users received from middleware: %v", users)
	return users, nil
}
