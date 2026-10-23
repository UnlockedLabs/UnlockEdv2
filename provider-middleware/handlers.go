package main

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/UnlockedLabs/unlocked-contracts/jobs"

	"github.com/nats-io/nats.go"
	"github.com/sirupsen/logrus"
)

func (sh *ServiceHandler) registerRoutes() {
	sh.Mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	sh.Mux.HandleFunc("GET /api/users", sh.handleUsers)
	sh.Mux.HandleFunc("GET /api/users/all", sh.handleAllUsers)
}

const CANCEL_TIMEOUT = 30 * time.Minute

func (sh *ServiceHandler) initSubscription() error {
	subscriptions := []struct {
		topic string
		fn    func(ctx context.Context, msg *nats.Msg)
	}{
		{jobs.GetCourses.PubName(), sh.handleCourses},
		{jobs.GetMilestones.PubName(), sh.handleMilestonesForCourseUser},
		{jobs.GetActivity.PubName(), sh.handleAcitivityForCourse},
		{jobs.ActivateScheduledClasses.PubName(), sh.handleActivateScheduledClasses},
	}
	for _, sub := range subscriptions {
		_, err := sh.nats.QueueSubscribe(sub.topic, "middleware", func(msg *nats.Msg) {
			ctx, cancel := context.WithTimeout(sh.ctx, CANCEL_TIMEOUT)
			defer cancel()
			sub.fn(ctx, msg)
		})
		if err != nil {
			logger().Fatalf("Error subscribing to NATS topic %s: %v", sub.topic, err)
			return err
		}
	}

	return nil
}

/**
* GET: /api/courses
* This handler will be responsible for importing courses from Providers
* to the UnlockEd platform, mapping their Content objects to our Course object
 */
func (sh *ServiceHandler) handleCourses(ctx context.Context, msg *nats.Msg) {
	service, err := sh.initProviderPlatformService(ctx, msg)
	if err != nil {
		logger().WithFields(logrus.Fields{"error": err.Error()}).Error("Failed to initialize service")
		return
	}
	params := service.GetJobParams()
	jobId := params["job_id"].(string)
	providerPlatformId := int(params["provider_platform_id"].(float64))
	success := service.ImportCourses(sh.db) == nil
	sh.cleanupJob(ctx, &providerPlatformId, jobId, success)
}

/**
* GET: /api/users
* This handler will be responsible for importing users from Providers
* to the UnlockEd platform with the proper fields for ProviderUserMapping
* and User objects
**/
func (sh *ServiceHandler) handleUsers(w http.ResponseWriter, r *http.Request) {
	fields := logrus.Fields{"handler": "handleUsers"}
	service, err := sh.initServiceFromRequest(sh.ctx, r)
	if err != nil {
		fields["error"] = err.Error()
		logger().WithFields(fields).Error("Failed to initialize service")
		// Without a status the caller gets 200 and an empty body, which reads as
		// "this provider has no users" instead of "this provider is unsupported".
		http.Error(w, "Failed to initialize provider service", providerServiceStatus(err))
		return
	}
	users, err := service.GetUsers(sh.db)
	if err != nil {
		logger().WithFields(fields).Errorln("Failed to retrieve users")
		http.Error(w, "Failed to retrieve users", http.StatusInternalServerError)
		return
	}
	responseData, err := json.Marshal(&users)
	if err != nil {
		logger().WithFields(fields).Errorln("Failed to marshal users")
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if _, err = w.Write(responseData); err != nil {
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

// handleAllUsers returns all Canvas users including those already mapped,
// so the backend can resolve canvas display names for the mapped-users page.
func (sh *ServiceHandler) handleAllUsers(w http.ResponseWriter, r *http.Request) {
	fields := logrus.Fields{"handler": "handleAllUsers"}
	service, err := sh.initServiceFromRequest(sh.ctx, r)
	if err != nil {
		fields["error"] = err.Error()
		logger().WithFields(fields).Error("Failed to initialize service")
		http.Error(w, "Failed to initialize service", providerServiceStatus(err))
		return
	}
	canvas, ok := service.(*CanvasService)
	if !ok {
		// Non-Canvas providers don't need this endpoint; return empty list.
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte("[]"))
		return
	}
	users, err := canvas.GetAllUsers()
	if err != nil {
		logger().WithFields(fields).Errorln("Failed to retrieve all users")
		http.Error(w, "Failed to retrieve users", http.StatusInternalServerError)
		return
	}
	responseData, err := json.Marshal(&users)
	if err != nil {
		logger().WithFields(fields).Errorln("Failed to marshal users")
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if _, err = w.Write(responseData); err != nil {
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
	}
}

func (sh *ServiceHandler) handleMilestonesForCourseUser(ctx context.Context, msg *nats.Msg) {
	service, err := sh.initProviderPlatformService(ctx, msg)
	if err != nil {
		logger().WithFields(logrus.Fields{"error": err.Error()}).Error("Failed to initialize service")
		return
	}
	logger().Println("initiating GetMilestonesForCourseUser milestones")
	params := service.GetJobParams()
	jobId := params["job_id"].(string)
	providerPlatformId := int(params["provider_platform_id"].(float64))
	usersMap, err := sh.lookupUserMapping(params)
	if err != nil {
		sh.cleanupJob(ctx, &providerPlatformId, jobId, false)
	}
	coursesMap, err := sh.lookupCoursesMapping(providerPlatformId)
	if err != nil {
		sh.cleanupJob(ctx, &providerPlatformId, jobId, false)
	}
	success := true
	lastRunStr := params["last_run"].(string)
	lastRun, err := time.Parse(time.RFC3339, lastRunStr)
	if err != nil {
		sh.cleanupJob(ctx, &providerPlatformId, jobId, false)
		return
	}
	for _, course := range coursesMap {
		select {
		case <-ctx.Done():
			logger().Println("context cancelled for getMilestones")
			return
		default:
			err = service.ImportMilestones(course, usersMap, sh.db, lastRun)
			time.Sleep(TIMEOUT_WAIT * time.Second) // to avoid rate limiting with the provider
			if err != nil {
				success = false
				logger().Errorf("Failed to retrieve milestones: %v", err)
				continue
			}
		}
	}
	sh.cleanupJob(ctx, &providerPlatformId, jobId, success)
}

func (sh *ServiceHandler) handleAcitivityForCourse(ctx context.Context, msg *nats.Msg) {
	service, err := sh.initProviderPlatformService(ctx, msg)
	if err != nil {
		logger().WithFields(logrus.Fields{"error": err.Error()}).Error("Failed to initialize service")
		return
	}
	success := true
	params := service.GetJobParams()
	jobId := params["job_id"].(string)
	providerPlatformId := int(params["provider_platform_id"].(float64))
	courses, err := sh.lookupCoursesMapping(providerPlatformId)
	if err != nil {
		sh.cleanupJob(ctx, &providerPlatformId, jobId, false)
		return
	}
	for _, course := range courses {
		select {
		case <-ctx.Done():
			logger().Println("context cancelled for getActivity")
			return
		default:
			err = service.ImportActivityForCourse(course, sh.db)
			if err != nil {
				success = false
				logger().Errorf("failed to get course activity: %v", err)
				continue
			}
		}
	}
	sh.cleanupJob(ctx, &providerPlatformId, jobId, success)
}
