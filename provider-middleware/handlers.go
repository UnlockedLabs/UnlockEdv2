package main

import (
	"encoding/json"
	"fmt"
	"net/http"

	log "github.com/sirupsen/logrus"
)

func (sh *ServiceHandler) registerRoutes() {
	sh.Mux.Handle("/", sh.applyMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})))
	sh.Mux.Handle("POST /api/add-provider", sh.authMiddleware(http.HandlerFunc(sh.handleAddProvider)))
	sh.Mux.Handle("GET /api/users", sh.applyMiddleware(http.HandlerFunc(sh.handleUsers)))
	sh.Mux.Handle("GET /api/programs", sh.applyMiddleware(http.HandlerFunc(sh.handlePrograms)))
	sh.Mux.Handle("GET /api/users/{id}/programs/{program_id}/milestones", sh.applyMiddleware(http.HandlerFunc(sh.handleMilestonesForProgramUser)))
	sh.Mux.Handle("GET /api/programs/{id}/activity", sh.applyMiddleware(http.HandlerFunc(sh.handleAcitivityForProgram)))
}

/**
* POST: /api/add-provider
* This handler will be responsible for adding a new provider to the database
* so that we can initiate a new Kolibri service for that provider
**/
func (sh *ServiceHandler) handleAddProvider(w http.ResponseWriter, r *http.Request) {
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

/**
* GET: /api/courses
* This handler will be responsible for importing courses from Providers
* to the UnlockEd platform, mapping their Content objects to our Course object
 */
func (sh *ServiceHandler) handlePrograms(w http.ResponseWriter, r *http.Request) {
	service := sh.getService(r)
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
func (sh *ServiceHandler) handleUsers(w http.ResponseWriter, r *http.Request) {
	service := sh.getService(r)
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

/**
* POST: /api/milestones
* body: {"user_id": x,"program_id": y}
 */
func (sh *ServiceHandler) handleMilestonesForProgramUser(w http.ResponseWriter, r *http.Request) {
	service := sh.getService(r)
	userId := r.PathValue("id")
	programId := r.PathValue("program_id")
	log.Println("initiating GetMilestonesForProgramUser milestones")
	milestones, err := service.GetMilestonesForProgramUser(userId, programId)
	if err != nil {
		log.Errorf("Failed to retrieve milestones: %v", err)
		return
	}
	responseData, err := json.Marshal(&milestones)
	if err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		log.Errorf("Failed to encode response: %v", err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if _, err = w.Write(responseData); err != nil {
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		log.Errorf("Failed to write response: %v", err)
		return
	}
}

func (srv *ServiceHandler) handleAcitivityForProgram(w http.ResponseWriter, r *http.Request) {
	service := srv.getService(r)
	programId := r.PathValue("id")
	activity, err := service.GetActivityForProgram(programId)
	if err != nil {
		log.Errorf("failed to get program activity: %v", err)
		http.Error(w, fmt.Sprintf("failed to get program activity: %v", err), http.StatusInternalServerError)
		return
	}
	jsonResp, err := json.Marshal(&activity)
	if err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if _, err = w.Write(jsonResp); err != nil {
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}
