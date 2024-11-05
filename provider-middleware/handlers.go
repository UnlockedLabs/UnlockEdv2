package main

import (
	"UnlockEdv2/src/models"
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/sirupsen/logrus"
)

func (sh *ServiceHandler) registerRoutes() {
	sh.Mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	sh.Mux.HandleFunc("GET /api/users", sh.handleUsers)
}

const (
	CANCEL_TIMEOUT = 30 * time.Minute
)

func (sh *ServiceHandler) initSubscription() error {
	subscriptions := []struct {
		topic string
		fn    func(ctx context.Context, msg *nats.Msg)
	}{
		{models.GetCoursesJob.PubName(), sh.handleCourses},
		{models.GetMilestonesJob.PubName(), sh.handleMilestonesForCourseUser},
		{models.GetActivityJob.PubName(), sh.handleAcitivityForCourse},
		{models.ScrapeKiwixJob.PubName(), sh.handleScrapeLibraries},
		{models.AddVideosJob.PubName(), sh.handleAddVideos},
		{models.RetryVideoDownloadsJob.PubName(), sh.handleRetryFailedVideos},
		{models.RetryManualDownloadJob.PubName(), sh.handleManualRetryDownload},
	}
	for _, sub := range subscriptions {
		_, err := sh.nats.Subscribe(sub.topic, func(msg *nats.Msg) {
			go sub.fn(sh.ctx, msg)
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
	contxt, cancel := context.WithTimeout(ctx, CANCEL_TIMEOUT)
	defer cancel()
	service, err := sh.initProviderPlatformService(contxt, msg)
	if err != nil {
		logger().WithFields(logrus.Fields{"error": err.Error()}).Error("Failed to initialize service")
		return
	}
	params := *service.GetJobParams()
	jobId := params["job_id"].(string)
	providerPlatformId := int(params["provider_platform_id"].(float64))
	err = service.ImportCourses(sh.db)
	if err != nil {
		sh.cleanupJob(contxt, providerPlatformId, jobId, false)
		logger().Println("error importing kolibri courses", err)
		return
	}
	finished := nats.NewMsg("tasks.get_courses.completed")
	finished.Data = []byte(`{"job_id": "` + jobId + `"}`)
	err = sh.nats.PublishMsg(finished)
	if err != nil {
		logger().Errorln("Failed to publish message to NATS")
	}
	sh.cleanupJob(contxt, providerPlatformId, jobId, true)
}

func (sh *ServiceHandler) handleScrapeLibraries(ctx context.Context, msg *nats.Msg) {
	contxt, cancel := context.WithTimeout(ctx, CANCEL_TIMEOUT)
	defer cancel()
	provider, body, err := sh.getContentProvider(msg)
	if err != nil {
		logger().Errorf("error fetching provider service from msg parameters %v", err)
		return
	}
	jobId := body["job_id"].(string)
	kiwixService := NewKiwixService(provider, &body)
	err = kiwixService.ImportLibraries(contxt, sh.db)
	if err != nil {
		logger().Errorf("error importing libraries from msg %v", err)
		sh.cleanupJob(contxt, int(provider.ID), jobId, false)
		return
	}

	sh.cleanupJob(contxt, int(provider.ID), jobId, true)
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

func (sh *ServiceHandler) handleMilestonesForCourseUser(ctx context.Context, msg *nats.Msg) {
	contxt, cancel := context.WithTimeout(ctx, CANCEL_TIMEOUT)
	defer cancel()
	service, err := sh.initProviderPlatformService(contxt, msg)
	if err != nil {
		logger().WithFields(logrus.Fields{"error": err.Error()}).Error("Failed to initialize service")
		return
	}
	logger().Println("initiating GetMilestonesForCourseUser milestones")
	params := *service.GetJobParams()
	courses := extractArrayMap(params, "courses")
	users := extractArrayMap(params, "user_mappings")
	jobId := params["job_id"].(string)
	lastRunStr := params["last_run"].(string)
	providerPlatformId := int(params["provider_platform_id"].(float64))
	lastRun, err := time.Parse(time.RFC3339, lastRunStr)
	if err != nil {
		sh.cleanupJob(contxt, providerPlatformId, jobId, false)
		return
	}
	for _, course := range courses {
		select {
		case <-contxt.Done():
			logger().Println("context cancelled for getMilestones")
			return
		default:
			err = service.ImportMilestones(course, users, sh.db, lastRun)
			time.Sleep(TIMEOUT_WAIT * time.Second) // to avoid rate limiting with the provider
			if err != nil {
				logger().Errorf("Failed to retrieve milestones: %v", err)
				continue
			}
		}
	}
	sh.cleanupJob(contxt, providerPlatformId, jobId, true)
}

func (sh *ServiceHandler) handleAcitivityForCourse(ctx context.Context, msg *nats.Msg) {
	contxt, cancel := context.WithTimeout(ctx, CANCEL_TIMEOUT)
	defer cancel()
	service, err := sh.initProviderPlatformService(contxt, msg)
	if err != nil {
		logger().WithFields(logrus.Fields{"error": err.Error()}).Error("Failed to initialize service")
		return
	}
	params := *service.GetJobParams()
	logger().Println("params for activity job: ", params)
	courses := extractArrayMap(params, "courses")
	jobId := params["job_id"].(string)
	providerPlatformId := int(params["provider_platform_id"].(float64))
	for _, course := range courses {
		select {
		case <-contxt.Done():
			logger().Println("context cancelled for getActivity")
			return
		default:
			err = service.ImportActivityForCourse(course, sh.db)
			if err != nil {
				sh.cleanupJob(contxt, providerPlatformId, jobId, false)
				logger().Errorf("failed to get course activity: %v", err)
				continue
			}
		}
	}
	sh.cleanupJob(contxt, providerPlatformId, jobId, true)
}

func (sh *ServiceHandler) handleAddVideos(ctx context.Context, msg *nats.Msg) {
	contxt, cancel := context.WithTimeout(ctx, CANCEL_TIMEOUT)
	defer cancel()
	provider, body, err := sh.getContentProvider(msg)
	if err != nil {
		logger().Errorf("error fetching provider from msg parameters %v", err)
		return
	}
	ytService := NewVideoService(provider, sh.db, &body)
	err = ytService.AddVideos(contxt)
	if err != nil {
		logger().Errorf("error adding videos: %v", err)
		return
	}
	// this is a one time job, so it doesn't need cleanup
}

func (sh *ServiceHandler) handleManualRetryDownload(ctx context.Context, msg *nats.Msg) {
	logger().Infof("Retrying failed video")
	contxt, cancel := context.WithTimeout(ctx, CANCEL_TIMEOUT)
	defer cancel()
	provider, body, err := sh.getContentProvider(msg)
	if err != nil {
		logger().Errorf("error fetching provider from msg parameters %v", err)
		return
	}
	ytService := NewVideoService(provider, sh.db, &body)
	videoId, ok := body["video_id"].(float64)
	if ok {
		err = ytService.RetrySingleVideo(contxt, int(videoId))
		if err != nil {
			logger().Errorf("error retrying single video: %v", err)
		}
		return
	}
	logger().Errorf("video_id not found in body")
}

func (sh *ServiceHandler) handleRetryFailedVideos(ctx context.Context, msg *nats.Msg) {
	logger().Infof("Retrying failed videos")
	contxt, cancel := context.WithTimeout(ctx, CANCEL_TIMEOUT)
	defer cancel()
	provider, body, err := sh.getContentProvider(msg)
	if err != nil {
		logger().Errorf("error fetching provider from msg parameters %v", err)
		return
	}
	ytService := NewVideoService(provider, sh.db, &body)
	err = ytService.RetryFailedVideos(contxt)
	if err != nil {
		logger().Errorf("error retrying failed videos: %v", err)
		return
	}
	sh.cleanupJob(contxt, int(provider.ID), body["job_id"].(string), true)
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
