package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"
)

/**
* Our main handler function that will handle all incoming requests
* and route them to the appropriate handler function
**/
func (sh *ServiceHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	sh.handleAuthMiddleware(w, r)
	log.Printf("Request URL:  %v ", r.URL)
	id, err := strconv.Atoi(r.URL.Query().Get("id"))
	if err != nil {
		log.Println("Failed to parse ID")
	}
	if r.Method == http.MethodPost && r.URL.Path == "/api/add-provider" {
		log.Println("Add provider called")
		id = sh.handleAddProvider(w, r)
	}
	service, err := sh.FindService(id)
	if err != nil {
		service, err = sh.InitService(id)
		if err != nil {
			http.Error(w, "Failed to initialize service", http.StatusNotFound)
			return
		}
	}
	switch r.URL.Path {
	case "/":
		if _, err = w.Write([]byte("Provider middleware initiated")); err != nil {
			http.Error(w, "Failed to write response", http.StatusInternalServerError)
			return
		}
	case "/api/users":
		sh.handleUsers(w, r, service)
		return
	case "/api/programs":
		sh.handlePrograms(w, r, service)
		return
	default:
		http.NotFound(w, r)
		return
	}
}

/**
* POST: /api/add-provider
* This handler will be responsible for adding a new provider to the database
* so that we can initiate a new Kolibri service for that provider
**/
func (sh *ServiceHandler) handleAddProvider(w http.ResponseWriter, r *http.Request) int {
	// deserialize from request body
	providerPlatform := ProviderPlatform{}
	log.Println("Adding provider")
	err := json.NewDecoder(r.Body).Decode(&providerPlatform)
	defer r.Body.Close()
	if err != nil {
		log.Printf("Failed to decode request body: %v", err)
		http.Error(w, "Failed to decode request body", http.StatusBadRequest)
	}
	id, err := providerPlatform.SaveProvider(sh.db)
	if err != nil {
		log.Printf("Failed to save provider: %v", err)
		http.Error(w, "Failed to save provider", http.StatusInternalServerError)
	}
	w.WriteHeader(http.StatusCreated)
	if _, err = w.Write([]byte("Provider created successfully")); err != nil {
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
	}
	return id
}

func (sh *ServiceHandler) InitService(id int) (ProviderServiceInterface, error) {
	provider, err := sh.LookupProvider(id)
	log.Println("InitService called")
	if err != nil {
		log.Printf("Error: %v", err)
		return nil, fmt.Errorf("failed to find provider: %v", err)
	}
	if provider.Type == "kolibri" {
		service := NewKolibriService(provider)
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
	} else {
		log.Printf("NewCanvasService")
		canvas := NewCanvasService(provider)
		sh.mutex.Lock()
		sh.services = append(sh.services, canvas)
		sh.mutex.Unlock()
		return canvas, nil
	}
}

func (sh *ServiceHandler) FindService(id int) (ProviderServiceInterface, error) {
	for _, service := range sh.services {
		if service.GetID() == id {
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
func (sh *ServiceHandler) handlePrograms(w http.ResponseWriter, r *http.Request, service ProviderServiceInterface) {
	courses, err := service.GetPrograms()
	if err != nil {
		log.Println(err)
		http.Error(w, "Failed to retrieve courses", http.StatusBadRequest)
		return
	}
	responseData, err := json.Marshal(courses)
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
func (sh *ServiceHandler) handleUsers(w http.ResponseWriter, r *http.Request, service ProviderServiceInterface) {
	users, err := service.GetUsers()
	if err != nil {
		log.Printf("Failed to retrieve users: %v", err)
		http.Error(w, "Failed to retrieve users", http.StatusInternalServerError)
		return
	}
	responseData, err := json.Marshal(&users)
	if err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if _, err = w.Write(responseData); err != nil {
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}
