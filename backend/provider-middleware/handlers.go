package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

/**
* POST: /api/add-provider
* This handler will be responsible for adding a new provider to the database
* so that we can initiate a new Kolibri service for that provider
**/
func (sh *ServiceHandler) HandleAddProvider(w http.ResponseWriter, r *http.Request) {
	// deserialize from request body
	providerPlatform := ProviderPlatform{}
	log.Println("Adding provider")
	err := json.NewDecoder(r.Body).Decode(&providerPlatform)
	defer r.Body.Close()
	if err != nil {
		log.Printf("Failed to decode request body: %v", err)
		http.Error(w, "Failed to decode request body", http.StatusBadRequest)
		return
	}
	err = providerPlatform.SaveProvider(sh.db)
	if err != nil {
		log.Printf("Failed to save provider: %v", err)
		http.Error(w, "Failed to save provider", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	if _, err = w.Write([]byte("Provider created successfully")); err != nil {
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
	}
}

func (sh *ServiceHandler) InitService(id int) error {
	provider, err := sh.LookupProvider(id)
	log.Println("InitService called")
	if err != nil {
		log.Printf("Error: %v", err)
		return fmt.Errorf("failed to find provider: %v", err)
	}
	if provider.Type == "kolibri" {
		service := NewKolibriService(provider)
		if err := service.InitiateSession(); err != nil {
			log.Printf("Failed to initiate session: %v", err)
			return fmt.Errorf("failed to initiate session: %v", err)
		}
		ticker := time.NewTicker(5 * time.Minute)
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
		return nil
	} else {
		log.Printf("NewCanvasService")
		canvas := NewCanvasService(provider)
		sh.mutex.Lock()
		sh.services = append(sh.services, canvas)
		sh.mutex.Unlock()
		return nil
	}
}

func (sh *ServiceHandler) FindService(id int) int {
	for idx, service := range sh.services {
		if service.GetID() == id {
			return idx
		}
	}
	return -1
}

/**
* GET: /api/courses
* This handler will be responsible for importing courses from Providers
* to the UnlockEd platform, mapping their Content objects to our Course object
 */
func (sh *ServiceHandler) HandlePrograms(w http.ResponseWriter, r *http.Request) {
	idx := r.Context().Value(IDX).(int)
	service := sh.services[idx]
	courses, err := service.GetPrograms()
	if err != nil {
		log.Println(err)
		http.Error(w, "Failed to retrieve programs", http.StatusBadRequest)
		return
	}
	responseData, err := json.Marshal(&courses)
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
func (sh *ServiceHandler) HandleUsers(w http.ResponseWriter, r *http.Request) {
	id := r.Context().Value(IDX).(int)
	service := sh.services[id]
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
