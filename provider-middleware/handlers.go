package main

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/nats-io/nats.go"
	log "github.com/sirupsen/logrus"
)

func (sh *ServiceHandler) registerRoutes() {
	sh.Mux.Handle("/", sh.authMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})))
	sh.Mux.Handle("GET /api/users", sh.authMiddleware(http.HandlerFunc(sh.handleUsers)))
}

func (sh *ServiceHandler) initSubscription() error {
	_, err := sh.nats.Subscribe("tasks.get_courses", func(msg *nats.Msg) {
		go sh.handleCourses(msg)
	})
	if err != nil {
		log.Fatalf("Error subscribing to NATS topic: %v", err)
		return err
	}
	_, err = sh.nats.Subscribe("tasks.get_milestones", func(msg *nats.Msg) {
		go sh.handleMilestonesForCourseUser(msg)
	})
	if err != nil {
		log.Fatalf("Error subscribing to NATS topic: %v", err)
		return err
	}
	_, err = sh.nats.Subscribe("tasks.get_activity", func(msg *nats.Msg) {
		go sh.handleAcitivityForCourse(msg)
	})
	_, err = sh.nats.Subscribe("tasks.scrape_kiwix", func(msg *nats.Msg) {
		go sh.handleScrapeLibraries(msg)
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
func (sh *ServiceHandler) handleCourses(msg *nats.Msg) {
	service, err := sh.initService(msg)
	if err != nil {
		log.WithFields(log.Fields{"error": err.Error()}).Error("Failed to initialize service")
		return
	}
	params := *service.GetJobParams()
	jobId := params["job_id"].(string)
	providerPlatformId := int(params["provider_platform_id"].(float64))
	err = service.ImportCourses(sh.db)
	if err != nil {
		sh.cleanupJob(providerPlatformId, jobId, false)
		log.Println("error fetching provider service from msg parameters", err)
		return
	}
	finished := nats.NewMsg("tasks.get_courses.completed")
	finished.Data = []byte(`{"job_id": "` + jobId + `"}`)
	err = sh.nats.PublishMsg(finished)
	if err != nil {
		log.Errorln("Failed to publish message to NATS")
	}
	sh.cleanupJob(providerPlatformId, jobId, true)
}

// GET /api/libraries
// This handler will import the libraries from open content providers
func (sh *ServiceHandler) handleScrapeLibraries(msg *nats.Msg) {
	// call init service, which will parse through which of the ocp we are dealing with
	service := NewKiwixService()
	err := service.ImportLibraries(sh.db)
	if err != nil {
		log.Errorf("error importing libraries from msg %v", err)
	}
	// tell nats that we have completed the task
	// publish the message that we have finished
	// clean up the job
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
		return
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

func (sh *ServiceHandler) handleMilestonesForCourseUser(msg *nats.Msg) {
	service, err := sh.initService(msg)
	if err != nil {
		log.WithFields(log.Fields{"error": err.Error()}).Error("Failed to initialize service")
		return
	}
	log.Println("initiating GetMilestonesForCourseUser milestones")
	params := *service.GetJobParams()
	log.Traceln("params for milestones job: ", params)
	courses := extractArrayMap(params, "courses")
	users := extractArrayMap(params, "user_mappings")
	jobId := params["job_id"].(string)
	lastRunStr := params["last_run"].(string)
	providerPlatformId := int(params["provider_platform_id"].(float64))
	lastRun, err := time.Parse(time.RFC3339, lastRunStr)
	if err != nil {
		sh.cleanupJob(providerPlatformId, jobId, false)
		return
	}
	for _, course := range courses {
		err = service.ImportMilestones(course, users, sh.db, lastRun)
		time.Sleep(1 * time.Second) // to avoid rate limiting with the provider
		if err != nil {
			log.Errorf("Failed to retrieve milestones: %v", err)
			continue
		}
	}
	sh.cleanupJob(providerPlatformId, jobId, true)
}

func (sh *ServiceHandler) handleAcitivityForCourse(msg *nats.Msg) {
	service, err := sh.initService(msg)
	if err != nil {
		log.WithFields(log.Fields{"error": err.Error()}).Error("Failed to initialize service")
		return
	}
	params := *service.GetJobParams()
	log.Println("params for activity job: ", params)
	courses := extractArrayMap(params, "courses")
	jobId := params["job_id"].(string)
	providerPlatformId := int(params["provider_platform_id"].(float64))
	for _, course := range courses {
		err = service.ImportActivityForCourse(course, sh.db)
		if err != nil {
			sh.cleanupJob(providerPlatformId, jobId, false)
			log.Errorf("failed to get course activity: %v", err)
			continue
		}
	}
	sh.cleanupJob(providerPlatformId, jobId, true)
}

func extractArrayMap(params map[string]interface{}, mapType string) []map[string]interface{} {
	extractTo := []map[string]interface{}{}
	array, ok := params[mapType].([]interface{})
	if !ok {
		return extractTo
	}
	for _, prog := range array {
		extractTo = append(extractTo, prog.(map[string]interface{}))
	}
	return extractTo
}
