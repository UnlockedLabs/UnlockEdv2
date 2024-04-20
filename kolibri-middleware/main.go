package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/cookiejar"
	"os"
	"time"
)

/***
* Our service struct which will have the methods to interact with
* the Kolibri API and the neccessary fields, headers, cookies to make requests
***/
type KolibriService struct {
	Logger      *log.Logger
	BaseURL     string
	HttpClient  *http.Client
	BaseHeaders map[string]string
	username    string
	password    string
	FacilityID  string
	CSRFToken   string
}

/**
* Handler struct that will be passed to our HTTP server handlers
* to handle the different routes
* It will have a refernce to the KolibriService struct
**/
type KolibriHandler struct {
	service *KolibriService
}

/**
* Initializes a new KolibriService struct with the base URL of the Kolibri server
* Pulls the login info from ENV variables. In production, these should be set
* in /etc/environment
**/
func NewKolibriService(baseURL string) *KolibriService {
	jar, _ := cookiejar.New(nil)
	client := &http.Client{
		Jar: jar,
	}
	facilityId := os.Getenv("KOLIBRI_FACILITY_ID")
	username := os.Getenv("KOLIBRI_USERNAME")
	password := os.Getenv("KOLIBRI_PASSWORD")
	headers := map[string]string{
		"Content-Type":    "application/json",
		"Accept":          "application/json, text/plain, */*",
		"User-Agent":      "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
		"Referer":         baseURL + "/en/auth/",
		"Accept-Encoding": "gzip, deflate",
		"DNT":             "1",
		"Pragma":          "no-cache",
		"Accept-Language": "en-US,en;q=0.5",
	}
	return &KolibriService{
		BaseURL:     baseURL,
		HttpClient:  client,
		username:    username,
		password:    password,
		FacilityID:  facilityId,
		BaseHeaders: headers,
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
	req, err := http.NewRequest("PUT", ks.BaseURL+"/api/auth/session/current", bytes.NewReader(bodyBytes))
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
			fmt.Println("TOKEN: " + ks.CSRFToken)
		}
		fmt.Println(cookie.Name)
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
		"facility": ks.FacilityID,
	}
	loginBodyBytes, _ := json.Marshal(loginBody)
	loginRequest, err := http.NewRequest("POST", ks.BaseURL+"/api/auth/session/", bytes.NewReader(loginBodyBytes))
	if err != nil {
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

func (kh *KolibriService) SendGETRequest(url string) (*http.Response, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	for key, value := range kh.BaseHeaders {
		req.Header.Set(key, value)
	}
	resp, err := kh.HttpClient.Do(req)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

func (kh *KolibriService) SendPOSTRequest(url string, body []byte) (*http.Response, error) {
	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	for key, value := range kh.BaseHeaders {
		req.Header.Set(key, value)
	}
	resp, err := kh.HttpClient.Do(req)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

/**
* Our main handler function that will handle all incoming requests
* and route them to the appropriate handler function
**/
func (kh *KolibriHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	facility_id := r.URL.Query().Get("facility_id")
	if facility_id == "" {
		http.Error(w, "Facility ID not provided", http.StatusBadRequest)
		return
	}
	kh.service.FacilityID = facility_id
	switch r.URL.Path {
	case "/":
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Kolibri Session initiated"))
	case "/api/import-users":
		kh.handleUsers(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (ks *KolibriService) RefreshSession() error {
	body := map[string]interface{}{
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
	}
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequest("PUT", ks.BaseURL+"/api/auth/session/current", bytes.NewReader(bodyBytes))
	if err != nil {
		return err
	}
	for key, value := range ks.BaseHeaders {
		req.Header.Add(key, value)
	}
	req.Header.Add("X-CSRFToken", ks.CSRFToken)
	_, err = ks.HttpClient.Do(req)
	if err != nil {
		return err
	}
	return nil
}

/**
* GET: /kolibri/import-users
* This handler will be responsible for importing users from Kolibri
* to the UnlockEd platform with the proper fields for ProviderUserMapping
* and User objects
**/
func (kh *KolibriHandler) handleUsers(w http.ResponseWriter, r *http.Request) {
	users, err := kh.service.ListUsers()
	if err != nil {
		http.Error(w, "Failed to retrieve users", http.StatusInternalServerError)
		return
	}
	importUsers := make([]UnlockEdImportUser, len(users))
	for _, user := range users {
		ulUser, err := user.IntoImportUser()
		if err != nil {
			continue
		}
		importUsers = append(importUsers, ulUser)
	}
	responseData, err := json.Marshal(importUsers)
	if err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(responseData)
}

func main() {
	url := os.Getenv("KOLIBRI_URL")
	service := NewKolibriService(url)
	logger := log.New(os.Stdout, "kolibri-api", log.LstdFlags)
	service.Logger = logger
	log.Println("Initiating auth session...")
	err := service.InitiateSession()
	if err != nil {
		log.Fatalf("Failed to initiate session: %v", err)
	}

	ticker := time.NewTicker(1 * time.Minute)
	go func() {
		for range ticker.C {
			err := service.RefreshSession()
			if err != nil {
				log.Printf("Failed to refresh session: %v", err)
			} else {
				log.Println("Session refreshed successfully.")
			}
		}
	}()
	handler := &KolibriHandler{service: service}
	log.Println("Server starting on :8080")
	err = http.ListenAndServe(":8080", handler)
	if err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
