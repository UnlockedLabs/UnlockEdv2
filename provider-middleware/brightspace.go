package main

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

const (
	CsvDownloadPath     = "csvs"
	TokenEndpoint       = "https://auth.brightspace.com/core/connect/token"
	DataSetsEndpoint    = "https://unlocked.brightspacedemo.com/d2l/api/lp/1.28/dataExport/bds/list"
	DataDownloadEnpoint = "https://unlocked.brightspacedemo.com/d2l/api/lp/1.28/dataExport/bds/download/%s"
)

type BrightspaceService struct {
	ProviderPlatformID uint
	Client             *http.Client
	BaseURL            string
	ClientID           string
	ClientSecret       string
	RefreshToken       string
	Scope              string
	AccessToken        string
	BaseHeaders        *map[string]string
	JobParams          *map[string]interface{}
}

func newBrightspaceService(provider *models.ProviderPlatform, db *gorm.DB, params *map[string]interface{}) (*BrightspaceService, error) {
	keysSplit := strings.Split(provider.AccessKey, ";")
	if len(keysSplit) < 2 {
		return nil, errors.New("unable to find refresh token, unable to intialize BrightspaceService")
	}
	scope := os.Getenv("BRIGHTSPACE_SCOPE")
	if scope == "" {
		return nil, errors.New("no brightspace scope found, unable to intialize BrightspaceService")
	}
	brightspaceService := BrightspaceService{
		ProviderPlatformID: provider.ID,
		Client:             &http.Client{},
		BaseURL:            provider.BaseUrl,
		ClientID:           provider.AccountID,
		ClientSecret:       keysSplit[0],
		RefreshToken:       keysSplit[1],
		Scope:              scope,
		JobParams:          params,
	}
	data := url.Values{}
	data.Add("grant_type", "refresh_token")
	data.Add("refresh_token", brightspaceService.RefreshToken)
	data.Add("client_id", brightspaceService.ClientID)
	data.Add("client_secret", brightspaceService.ClientSecret)
	data.Add("scope", brightspaceService.Scope)
	log.Infof("refreshing token using endpoint url %v", TokenEndpoint)
	resp, err := brightspaceService.SendPostRequest(TokenEndpoint, data)
	if err != nil {
		log.Errorf("error sending post request to url %v", TokenEndpoint)
		return nil, err
	}
	var tokenMap map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&tokenMap); err != nil {
		log.Errorf("error decoding to response from url %v, error is: %v", TokenEndpoint, err)
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		errType, okError := tokenMap["error"].(string)
		errMsg, okDesc := tokenMap["error_description"].(string)
		msg := "unable to request new refresh token from brightspace"
		if okError && okDesc {
			msg = fmt.Sprintf("unable to request new refresh token from brightspace, response error message is: %s: %s", errType, errMsg)
			return nil, errors.New(msg)
		}
		return nil, errors.New(msg)
	}
	brightspaceService.AccessToken = tokenMap["access_token"].(string)
	brightspaceService.RefreshToken = tokenMap["refresh_token"].(string)
	provider.AccessKey = brightspaceService.ClientSecret + ";" + brightspaceService.RefreshToken
	if err := db.Save(&provider).Error; err != nil {
		log.Errorf("error trying to update provider access_key with new refresh token, error is %v", err)
		return nil, err
	}
	log.Info("refresh token updated successfully on the provider_platform")
	headers := make(map[string]string)
	headers["Authorization"] = "Bearer " + brightspaceService.AccessToken
	headers["Accept"] = "application/json"
	brightspaceService.BaseHeaders = &headers
	return &brightspaceService, nil
}

func (srv *BrightspaceService) SendPostRequest(url string, data url.Values) (*http.Response, error) {
	encodedUrl := data.Encode()
	req, err := http.NewRequest(http.MethodPost, url, strings.NewReader(encodedUrl))
	if err != nil {
		log.Errorf("error creating new POST request to url %v and error is: %v", url, err)
		return nil, err
	}
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded") //standard header for url.Values (encoded)
	resp, err := srv.Client.Do(req)
	if err != nil {
		log.Errorf("error executing POST request to url %v and error is: %v", url, err)
		return nil, err
	}
	return resp, nil
}

func (srv *BrightspaceService) SendRequest(url string) (*http.Response, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		log.Errorf("error creating new GET request to url %v and error is: %v", url, err)
		return nil, err
	}
	for key, value := range *srv.BaseHeaders {
		req.Header.Add(key, value)
	}
	resp, err := srv.Client.Do(req)
	if err != nil {
		log.Errorf("error executing GET request to url %v and error is: %v", url, err)
		return nil, err
	}
	return resp, nil
}

func (srv *BrightspaceService) GetUsers(db *gorm.DB) ([]models.ImportUser, error) {
	pluginId, err := srv.getPluginId("Users")
	if err != nil {
		log.Errorf("error attempting to get plugin id for users, error is: %v", err)
		return nil, err
	}
	log.Infof("successfully retrieved plugin id %v for downloading csv file for users", pluginId)
	downloadUrl := fmt.Sprintf(DataDownloadEnpoint, pluginId)
	csvFile, err := srv.downloadAndUnzipFile("Users.zip", downloadUrl)
	if err != nil {
		log.Errorf("error downloading and unzipping csv file, error is: %v", err)
		return nil, err
	}
	log.Infof("successfully downloaded and unzipped %v for importing users", csvFile)
	bsUsers := []BrightspaceUser{}
	importUsers := []models.ImportUser{}
	readCSV(&bsUsers, csvFile)
	cleanUpFiles("Users.zip", csvFile)
	fields := log.Fields{"provider": srv.ProviderPlatformID, "Function": "GetUsers", "csvFile": csvFile}
	log.WithFields(fields).Info("importing users from provider using csv file")
	for _, bsUser := range bsUsers {
		if strings.ToUpper(bsUser.IsActive) == "TRUE" {
			if db.Where("provider_platform_id = ? AND external_user_id = ?", srv.ProviderPlatformID, bsUser.UserId).First(&models.ProviderUserMapping{}).Error == nil {
				continue
			}
			user := srv.IntoImportUser(bsUser)
			importUsers = append(importUsers, *user)
		}
	}
	log.Info("successfully imported users from provider")
	return importUsers, nil
}

func (srv *BrightspaceService) ImportCourses(db *gorm.DB) error {
	pluginId, err := srv.getPluginId("Organizational Units")
	if err != nil {
		log.Errorf("error attempting to get plugin id for courses, error is: %v", err)
		return err
	}
	log.Infof("successfully retrieved plugin id %v for downloading csv file for courses", pluginId)
	downloadUrl := fmt.Sprintf(DataDownloadEnpoint, pluginId)
	csvFile, err := srv.downloadAndUnzipFile("OrganizationalUnits.zip", downloadUrl)
	if err != nil {
		log.Errorf("error attempting to get plugin id for courses, error is: %v", err)
		return err
	}
	log.Infof("successfully downloaded and unzipped %v for importing courses", csvFile)
	bsCourses := []BrightspaceCourse{}
	readCSV(&bsCourses, csvFile)
	cleanUpFiles("OrganizationalUnits.zip", csvFile)
	fields := log.Fields{"provider": srv.ProviderPlatformID, "Function": "ImportCourses", "csvFile": csvFile}
	log.WithFields(fields).Info("importing courses from provider using csv file")
	for _, bsCourse := range bsCourses {
		if bsCourse.IsActive == "TRUE" && bsCourse.IsDeleted == "FALSE" && bsCourse.Type == "Course Offering" {
			if db.Where("provider_platform_id = ? AND external_id = ?", srv.ProviderPlatformID, bsCourse.OrgUnitId).First(&models.Course{}).Error == nil {
				continue
			}
			log.Infof("importing course named %v with external id %v", bsCourse.Name, bsCourse.OrgUnitId)
			course := srv.IntoCourse(bsCourse)
			if err := db.Create(&course).Error; err != nil {
				log.Errorf("error creating course in db, error is: %v", err)
				continue
			}
		}
	}
	return nil
}

func (srv *BrightspaceService) ImportMilestones(coursePair map[string]interface{}, mappings []map[string]interface{}, db *gorm.DB, lastRun time.Time) error {
	fmt.Println("ImportMilestones...")
	return nil
}

func (srv *BrightspaceService) ImportActivityForCourse(coursePair map[string]interface{}, db *gorm.DB) error {
	fmt.Println("ImportActivityForCourse...")
	return nil
}

func (srv *BrightspaceService) GetJobParams() *map[string]interface{} {
	return srv.JobParams
}
