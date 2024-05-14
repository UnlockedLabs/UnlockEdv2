package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/cookiejar"

	"golang.org/x/net/publicsuffix"
)

/***
* Our service struct which will have the methods to interact with
* the Kolibri API and the neccessary fields, headers, cookies to make requests
***/
type KolibriService struct {
	ProviderPlatformID int
	BaseURL            string
	HttpClient         *http.Client
	BaseHeaders        map[string]string
	username           string
	password           string
	AccountID          string
	CSRFToken          string
	CancelRefresh      chan bool
}

/**
* Initializes a new KolibriService struct with the base URL of the Kolibri server
* Pulls the login info from ENV variables. In production, these should be set
* in /etc/environment
**/
func NewKolibriService(provider *ProviderPlatform) *KolibriService {
	jar, _ := cookiejar.New(&cookiejar.Options{PublicSuffixList: publicsuffix.List})
	client := &http.Client{
		Jar: jar,
	}
	headers := map[string]string{
		"Content-Type":    "application/json",
		"Accept":          "application/json, text/plain, */*",
		"User-Agent":      "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
		"Cache-Control":   "no-cache",
		"Accept-Encoding": "gzip, deflate",
		"DNT":             "1",
		"Pragma":          "no-cache",
		"Accept-Language": "en-US,en;q=0.5",
	}
	return &KolibriService{
		ProviderPlatformID: provider.ID,
		BaseURL:            provider.Url,
		HttpClient:         client,
		username:           provider.Username,
		password:           provider.Password,
		AccountID:          provider.AccountID,
		BaseHeaders:        headers,
	}
}

/**
* Initiates an auth session with the Kolibri server
* This allows us to make further requests to the server
* and get the necessary cookies and tokens
**/
func (ks *KolibriService) InitiateSession() error {
	initialBody := map[string]interface{}{
		"active": false,
		"browser": map[string]string{
			"name":  "Firefox",
			"major": "124",
			"minor": "0",
		},
		"os": map[string]string{
			"name":  "Linux",
			"major": "x86_64",
		},
	}
	bodyBytes, _ := json.Marshal(initialBody)
	req, err := http.NewRequest("PUT", ks.BaseURL+"/api/auth/session/current/", bytes.NewReader(bodyBytes))
	if err != nil {
		return err
	}
	for key, value := range ks.BaseHeaders {
		req.Header.Add(key, value)
	}
	_, err = ks.HttpClient.Do(req)
	cookies := ks.HttpClient.Jar.Cookies(req.URL)
	for _, cookie := range cookies {
		if cookie.Name == "kolibri_csrftoken" {
			ks.CSRFToken = cookie.Value
		}
	}
	if err != nil {
		return err
	}
	loginBody := map[string]interface{}{
		"active": true,
		"browser": map[string]string{
			"name":  "Firefox",
			"major": "124",
			"minor": "0",
		},
		"os": map[string]string{
			"name":  "Linux",
			"major": "x86_64",
		},
		"username": ks.username,
		"password": ks.password,
		"facility": ks.AccountID,
	}
	loginBodyBytes, _ := json.Marshal(loginBody)
	loginRequest, err := http.NewRequest("POST", ks.BaseURL+"/api/auth/session/", bytes.NewReader(loginBodyBytes))
	if err != nil { // ^^^ must end in trailing slash
		return err
	}
	for key, value := range ks.BaseHeaders {
		loginRequest.Header.Add(key, value)
	}
	loginRequest.Header.Add("X-CSRFToken", ks.CSRFToken)
	response, err := ks.HttpClient.Do(loginRequest)
	if err != nil {
		return err
	}
	log.Println(response.Status)
	responseData := make(map[string]interface{})

	err = json.NewDecoder(response.Body).Decode(&responseData)
	if err != nil {
		return nil
	}
	log.Println(responseData)
	return nil
}

func (ks *KolibriService) GetID() int {
	return ks.ProviderPlatformID
}

func (kh *KolibriService) SendGETRequest(url string) (*http.Response, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	for key, value := range kh.BaseHeaders {
		req.Header.Add(key, value)
	}
	req.Header.Add("Referrer", kh.BaseURL+"/en/learn/")
	req.Header.Add("X-CSRFToken", kh.CSRFToken)
	resp, err := kh.HttpClient.Do(req)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

func (ks *KolibriService) SendPOSTRequest(url string, body []byte) (*http.Response, error) {
	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	for key, value := range ks.BaseHeaders {
		req.Header.Set(key, value)
	}
	req.Header.Add("X-CSRFToken", ks.CSRFToken)
	resp, err := ks.HttpClient.Do(req)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

func (ks *KolibriService) SendPUTRequest(url string, body []byte) (*http.Response, error) {
	req, err := http.NewRequest("PUT", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	for key, value := range ks.BaseHeaders {
		req.Header.Set(key, value)
	}
	req.Header.Add("X-CSRFToken", ks.CSRFToken)
	resp, err := ks.HttpClient.Do(req)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

func (ks *KolibriService) RefreshSession() error {
	body := map[string]interface{}{
		"active": false,
		"browser": map[string]string{
			"name":  "Firefox",
			"major": "124",
			"minor": "0",
		},
		"os": map[string]string{
			"name":  "Linux",
			"major": "x86_64",
		},
	}
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequest("PUT", ks.BaseURL+"/api/auth/session/current/", bytes.NewReader(bodyBytes))
	if err != nil {
		return err
	}
	for key, value := range ks.BaseHeaders {
		req.Header.Add(key, value)
		log.Println(key, value)
	}
	req.Header.Add("X-CSRFToken", ks.CSRFToken)
	req.Header.Add("Referrer", ks.BaseURL+"/en/learn/")
	_, err = ks.HttpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to refresh session: %v", err)
	}
	cookies := ks.HttpClient.Jar.Cookies(req.URL)
	for _, cookie := range cookies {
		if cookie.Name == "kolibri_csrftoken" {
			ks.CSRFToken = cookie.Value
			log.Println("New CSRF Token: ", ks.CSRFToken)
		}
	}
	return nil
}

/**
* Method to list all users in a Kolibri facility
* @info - GET /api/auth/facilityuser?member_of=<facilityID>
* @return - List of KolibriUser objects, representing all users in the facility
**/
func (ks *KolibriService) GetUsers() ([]UnlockEdImportUser, error) {
	url := ks.BaseURL + "/api/auth/facilityuser?member_of=" + ks.AccountID
	response, err := ks.SendGETRequest(url)
	if err != nil {
		return nil, err
	}
	var users []KolibriUser
	err = json.NewDecoder(response.Body).Decode(&users)
	if err != nil {
		return nil, err
	}
	importUsers := make([]UnlockEdImportUser, len(users))
	for _, user := range users {
		ulUser, err := user.IntoImportUser()
		if err != nil {
			continue
		}
		importUsers = append(importUsers, *ulUser)
	}
	return importUsers, nil
}

/**
* @info - GET /api/content/channel?available=true
* @return - List of maps, each containing the details of a Content object
**/
func (ks *KolibriService) GetPrograms() ([]UnlockEdImportProgram, error) {
	url := ks.BaseURL + "/api/content/channel/?available=true"
	response, err := ks.SendGETRequest(url)
	if err != nil {
		return nil, err
	}
	var kolibriResponse []KolibriContent
	err = json.NewDecoder(response.Body).Decode(&kolibriResponse)
	if err != nil {
		return nil, err
	}
	var importCourses []UnlockEdImportProgram
	for _, course := range kolibriResponse {
		ulCourse := course.IntoCourse(ks.BaseURL)
		ulCourse.ProviderPlatformID = ks.ProviderPlatformID
		importCourses = append(importCourses, *ulCourse)
	}
	return importCourses, nil
}

func (ks *KolibriService) GetMilestonesForProgramUser(courseId, userId int) ([]UnlockEdImportMilestone, error) {
	return nil, nil
}
