package main

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"time"

	"github.com/nats-io/nats.go"
	log "github.com/sirupsen/logrus"
)

func (sh *ServiceHandler) registerRoutes() {
	sh.Mux.Handle("/", sh.applyMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})))
	sh.Mux.Handle("GET /api/users", sh.applyMiddleware(http.HandlerFunc(sh.handleUsers)))
}

func (sh *ServiceHandler) initSubscription() error {
	_, err := sh.nats.Subscribe("tasks.get_programs", func(msg *nats.Msg) {
		go sh.handlePrograms(msg)
	})
	if err != nil {
		log.Fatalf("Error subscribing to NATS topic: %v", err)
		return err
	}
	_, err = sh.nats.Subscribe("tasks.get_milestones", func(msg *nats.Msg) {
		go sh.handleMilestonesForProgramUser(msg)
	})
	if err != nil {
		log.Fatalf("Error subscribing to NATS topic: %v", err)
		return err
	}
	_, err = sh.nats.Subscribe("tasks.get_activity", func(msg *nats.Msg) {
		go sh.handleAcitivityForProgram(msg)
	})
	if err != nil {
		log.Fatalf("Error subscribing to NATS topic: %v", err)
		return err
	}
	return nil
}

/**
* GET: /api/courses
* This handler will be responsible for importing courses from Providers
* to the UnlockEd platform, mapping their Content objects to our Course object
 */
func (sh *ServiceHandler) handlePrograms(msg *nats.Msg) {
	service, err := sh.initService(msg)
	if err != nil {
		log.WithFields(log.Fields{"error": err.Error()}).Error("Failed to initialize service")
	}
	params := *service.GetJobParams()
	jobId := params["job_id"].(string)
	providerPlatformId := int(params["provider_platform_id"].(float64))
	err = service.ImportPrograms(sh.db)
	if err != nil {
		sh.cleanupJob(providerPlatformId, jobId, false)
		log.Println("error fetching provider service from msg parameters", err)
		return
	}
	finished := nats.NewMsg("tasks.get_programs.completed")
	finished.Data = []byte(`{"job_id": "` + jobId + `"}`)
	sh.nats.PublishMsg(finished)
	sh.cleanupJob(providerPlatformId, jobId, true)
}

/**
* GET: /api/users
* This handler will be responsible for importing users from Providers
* to the UnlockEd platform with the proper fields for ProviderUserMapping
* and User objects
**/
func (sh *ServiceHandler) handleUsers(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "handleUsers"}
	service, err := sh.initServiceFromRequest(r)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("Failed to initialize service")
	}
	users, err := service.GetUsers(sh.db)
	if err != nil {
		log.WithFields(fields).Errorln("Failed to retrieve users")
		http.Error(w, "Failed to retrieve users", http.StatusInternalServerError)
		return
	}
	responseData, err := json.Marshal(&users)
	if err != nil {
		log.WithFields(fields).Errorln("Failed to marshal users")
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if _, err = w.Write(responseData); err != nil {
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (sh *ServiceHandler) handleMilestonesForProgramUser(msg *nats.Msg) {
	service, err := sh.initService(msg)
	if err != nil {
		log.WithFields(log.Fields{"error": err.Error()}).Error("Failed to initialize service")
	}
	log.Println("initiating GetMilestonesForProgramUser milestones")
	params := *service.GetJobParams()
	log.Println("params for milestones job: ", params)
	programs, ok := params["programs"].([]map[string]interface{})
	if !ok {
		log.Errorf("failed to parse programs: %v", params["programs"])
		return
	}
	userMappings, ok := params["user_mappings"].([]models.ProviderUserMapping)
	if !ok {
		log.Errorf("failed to parse user mappings: %v", params["user_mappings"])
		return
	}
	jobId := params["job_id"].(string)
	lastRunStr := params["last_run"].(string)
	lastRun, err := time.Parse(time.RFC3339, lastRunStr)
	if err != nil {
		log.Errorf("failed to parse last run time: %v", err)
		// set last run to one week ago
		lastRun = time.Now().AddDate(0, 0, -7)
	}
	providerPlatformId := int(params["provider_platform_id"].(float64))
	for _, program := range programs {
		for _, user := range userMappings {
			err = service.ImportMilestonesForProgramUser(program, &user, sh.db, lastRun)
			if err != nil {
				sh.cleanupJob(providerPlatformId, jobId, true)
				log.Errorf("Failed to retrieve milestones: %v", err)
				continue
			}
		}
	}
	sh.cleanupJob(providerPlatformId, jobId, true)
}

func (sh *ServiceHandler) handleAcitivityForProgram(msg *nats.Msg) {
	service, err := sh.initService(msg)
	if err != nil {
		log.WithFields(log.Fields{"error": err.Error()}).Error("Failed to initialize service")
	}
	params := *service.GetJobParams()
	log.Println("params for activity job: ", params)
	programs, ok := params["programs"].([]map[string]interface{})
	if !ok {
		log.Errorf("failed to parse programs: %v", params["programs"])
		return
	}
	jobId := params["job_id"].(string)
	providerPlatformId := int(params["provider_platform_id"].(float64))
	for _, program := range programs {
		err = service.ImportActivityForProgram(program, sh.db)
		if err != nil {
			sh.cleanupJob(providerPlatformId, jobId, false)
			log.Errorf("failed to get program activity: %v", err)
			continue
		}
	}
	sh.cleanupJob(providerPlatformId, jobId, true)
}
