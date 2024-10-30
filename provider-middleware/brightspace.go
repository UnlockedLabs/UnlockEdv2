package main

import (
	"UnlockEdv2/src/models"
	"errors"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"gorm.io/gorm"
)

const (
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

// for linting reasons changed new to New below temporarily so this can be reviewed,
func NewBrightspaceService(provider *models.ProviderPlatform, db *gorm.DB, params *map[string]interface{}) (*BrightspaceService, error) {
	keysSplit := strings.Split(provider.AccessKey, ";")
	if len(keysSplit) < 2 {
		return nil, errors.New("unable to find refresh token, unable to intialize BrightspaceService")
	}
	scope := os.Getenv("BRIGHTSPACE_SCOPE")
	if scope == "" {
		return nil, errors.New("no brightspace scope found, unable to intialize BrightspaceService")
	}
	brightspaceService := BrightspaceService{
		//brightspace - set fields
		JobParams: params,
	}
	data := url.Values{}
	data.Add("grant_type", "refresh_token")
	data.Add("refresh_token", brightspaceService.RefreshToken)
	data.Add("client_id", brightspaceService.ClientID)
	data.Add("client_secret", brightspaceService.ClientSecret)
	data.Add("scope", brightspaceService.Scope)
	//a send post request to brightspace
	//b parse response for access_token and refresh_token
	//c save new refresh_token (tack it onto the end of the client secret separated by semicolon)
	provider.AccessKey = brightspaceService.ClientSecret + ";" + brightspaceService.RefreshToken
	if err := db.Debug().Save(&provider).Error; err != nil {
		//send admin email??? maybe but not now
		return nil, err
	}
	//d set headers that are required for requests to brightspace
	headers := make(map[string]string)
	headers["Authorization"] = "Bearer " + brightspaceService.AccessToken
	headers["Accept"] = "application/json"
	brightspaceService.BaseHeaders = &headers
	return &brightspaceService, nil
}

func (srv *BrightspaceService) GetUsers(db *gorm.DB) ([]models.ImportUser, error) {
	//get brightspace users
	return nil, nil
}

func (srv *BrightspaceService) ImportCourses(db *gorm.DB) error {
	//import brightspace courses
	return nil
}

func (srv *BrightspaceService) ImportMilestones(coursePair map[string]interface{}, mappings []map[string]interface{}, db *gorm.DB, lastRun time.Time) error {
	//import milestones
	return nil
}

func (srv *BrightspaceService) ImportActivityForCourse(coursePair map[string]interface{}, db *gorm.DB) error {
	//import activity for course
	return nil
}

func (srv *BrightspaceService) GetJobParams() *map[string]interface{} {
	//get job parameters
	return srv.JobParams
}
