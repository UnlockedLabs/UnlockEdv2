package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (sh *ServiceHandler) registerRoutes() {
	sh.Mux.Handle("/", sh.applyMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})))
	sh.Mux.Handle("GET /api/users", sh.applyMiddleware(http.HandlerFunc(sh.handleUsers)))
	sh.Mux.Handle("GET /api/programs", sh.applyMiddleware(http.HandlerFunc(sh.handlePrograms)))
	sh.Mux.Handle("GET /api/users/{id}/programs/{program_id}/milestones", sh.applyMiddleware(http.HandlerFunc(sh.handleMilestonesForProgramUser)))
	sh.Mux.Handle("GET /api/programs/{id}/activity", sh.applyMiddleware(http.HandlerFunc(sh.handleAcitivityForProgram)))
}

/**
* GET: /api/courses
* This handler will be responsible for importing courses from Providers
* to the UnlockEd platform, mapping their Content objects to our Course object
 */
func (sh *ServiceHandler) handlePrograms(w http.ResponseWriter, r *http.Request) {
	service, err := sh.initService(r)
	if err != nil {
		log.WithFields(log.Fields{"error": err.Error()}).Error("Failed to initialize service")
	}
	err = service.ImportPrograms(sh.db)
	if err != nil {
		log.Println(err)
		http.Error(w, "Failed to retrieve programs", http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusOK)
}

/**
* GET: /api/users
* This handler will be responsible for importing users from Providers
* to the UnlockEd platform with the proper fields for ProviderUserMapping
* and User objects
**/
func (sh *ServiceHandler) handleUsers(w http.ResponseWriter, r *http.Request) {
	service, err := sh.initService(r)
	if err != nil {
		log.WithFields(log.Fields{"error": err.Error()}).Error("Failed to initialize service")
	}
	users, err := service.GetUsers(sh.db)
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
	service, err := sh.initService(r)
	if err != nil {
		log.WithFields(log.Fields{"error": err.Error()}).Error("Failed to initialize service")
	}
	userId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Errorln("failed to parse integer from path value handleMilestonesForProgramUser")
		http.Error(w, "failed to parse userID from path", http.StatusBadRequest)
		return
	}
	programId, err := strconv.Atoi(r.PathValue("program_id"))
	if err != nil {
		log.Errorln("failed to parse integer from path value handleMilestonesForProgramUser")
		http.Error(w, "failed to parse programID from path", http.StatusBadRequest)
		return
	}
	log.Println("initiating GetMilestonesForProgramUser milestones")
	err = service.ImportMilestonesForProgramUser(uint(userId), uint(programId), sh.db)
	if err != nil {
		log.Errorf("Failed to retrieve milestones: %v", err)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (srv *ServiceHandler) handleAcitivityForProgram(w http.ResponseWriter, r *http.Request) {
	service, err := srv.initService(r)
	if err != nil {
		log.WithFields(log.Fields{"error": err.Error()}).Error("Failed to initialize service")
	}
	programId := r.PathValue("id")
	err = service.ImportActivityForProgram(programId, srv.db)
	if err != nil {
		log.Errorf("failed to get program activity: %v", err)
		http.Error(w, fmt.Sprintf("failed to get program activity: %v", err), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}
