package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

/**
* Our main handler function that will handle all incoming requests
* and route them to the appropriate handler function
**/
func (sh *ServiceHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	sh.handleAuthMiddleware(w, r)
	log.Println("Request URL: ", r.URL.Path)
	facility_id := r.URL.Query().Get("facility_id")
	if facility_id == "" {
		http.Error(w, "Provider not found with that Facility ID", http.StatusBadRequest)
		return
	}
	if r.Method == http.MethodPost && r.URL.Path == "/api/add-provider" {
		sh.handleAddProvider(w, r)
	}
	service, err := sh.FindService(facility_id)
	if err != nil {
		service, err = sh.InitService(facility_id)
		if err != nil {
			http.Error(w, "Failed to initialize service", http.StatusNotFound)
			return
		}
	}
	// check if we have a service running for the facility ID
	// if not, we initialize a new service and store the reference
	switch r.URL.Path {
	case "/":
		w.WriteHeader(http.StatusOK)
		if _, err = w.Write([]byte("Kolibri Session initiated")); err != nil {
			http.Error(w, "Failed to write response", http.StatusInternalServerError)
		}
	case "/api/users":
		sh.handleUsers(w, r, service)
	case "/api/courses":
		sh.handleCourses(w, r, service)
	default:
		http.NotFound(w, r)
	}
}

/**
* POST: /api/add-provider
* This handler will be responsible for adding a new provider to the database
* so that we can initiate a new Kolibri service for that provider
**/
func (sh *ServiceHandler) handleAddProvider(w http.ResponseWriter, r *http.Request) {
	provider, err := NewProviderFromForm(r)
	if err != nil {
		log.Printf("Failed to create provider: %v", err)
		http.Error(w, "Failed to create provider", http.StatusBadRequest)
	}
	err = provider.SaveProvider(sh.db)
	if err != nil {
		log.Printf("Failed to save provider: %v", err)
		http.Error(w, "Failed to save provider", http.StatusInternalServerError)
	}
	w.WriteHeader(http.StatusCreated)
	if _, err = w.Write([]byte("Provider created successfully")); err != nil {
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
	}
}

func (sh *ServiceHandler) InitService(facilityId string) (*ProviderService, error) {
	provider, err := sh.LookupProvider(facilityId)
	log.Println("InitService called")
	if err == nil {
		log.Printf("Failed to find provider: %v", err)
	}
	service := NewProviderService(&provider)
	if err := service.InitiateSession(); err != nil {
		log.Printf("Failed to initiate session: %v", err)
		return nil, fmt.Errorf("failed to initiate session: %v", err)
	}
	ticker := time.NewTicker(2 * time.Minute)
	done := make(chan bool)
	go func() {
		for {
			select {
			case <-done:
				ticker.Stop()
				return
			case <-ticker.C:
				err := service.RefreshSession()
				if err != nil {
					log.Printf("Failed to refresh session: %v", err)
				} else {
					log.Println("Session refreshed successfully.")
				}
			}
		}
	}()
	sh.mutex.Lock()
	sh.services = append(sh.services, service)
	sh.mutex.Unlock()
	return service, nil
}

func (sh *ServiceHandler) FindService(facilityID string) (*ProviderService, error) {
	for _, service := range sh.services {
		if service.FacilityID == facilityID {
			return service, nil
		}
	}
	return nil, fmt.Errorf("service not found")
}

/**
* Middleware function to be sure we are authenticated before
* making any requests to the Kolibri server
* This will be used in all routes that require authentication
**/
func (sh *ServiceHandler) handleAuthMiddleware(w http.ResponseWriter, r *http.Request) {
	checkHeader := r.Header.Get("Authorization")
	if checkHeader == "" || checkHeader != sh.token {
		log.Println("Authorization failure")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
}

/**
* GET: /api/courses
* This handler will be responsible for importing courses from Providers
* to the UnlockEd platform, mapping their Content objects to our Course object
 */
func (sh *ServiceHandler) handleCourses(w http.ResponseWriter, r *http.Request, service *ProviderService) {
	courses, err := service.GetContent()
	if err != nil {
		log.Println(err)
		http.Error(w, "Failed to retrieve courses", http.StatusBadRequest)
		return
	}
	importCourses := make([]UnlockEdCourse, 0)
	for _, course := range courses {
		ulCourse := course.IntoCourse(service.FacilityID)
		importCourses = append(importCourses, ulCourse)
	}
	responseData, err := json.Marshal(importCourses)
	if err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if _, err = w.Write(responseData); err != nil {
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
	}
}

/**
* GET: /api/users
* This handler will be responsible for importing users from Providers
* to the UnlockEd platform with the proper fields for ProviderUserMapping
* and User objects
**/
func (kh *ServiceHandler) handleUsers(w http.ResponseWriter, r *http.Request, service *ProviderService) {
	users, err := service.GetUsers()
	if err != nil {
		log.Printf("Failed to retrieve users: %v", err)
		http.Error(w, "Failed to retrieve users", http.StatusInternalServerError)
		return
	}
	responseData, err := json.Marshal(users)
	if err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if _, err = w.Write(responseData); err != nil {
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
	}
}
