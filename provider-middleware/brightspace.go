package main

import (
	"UnlockEdv2/src/models"
	"net/http"
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

func newBrightspaceService(provider *models.ProviderPlatform, db *gorm.DB, params *map[string]interface{}) (*BrightspaceService, error) {
	//create new instance of BrightspaceService
	return nil, nil
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
