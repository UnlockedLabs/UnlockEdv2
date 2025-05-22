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
	CANCEL_TIMEOUT       = 30 * time.Minute
	VIDEO_CANCEL_TIMEOUT = 4 * time.Hour
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
		{models.SyncVideoMetadataJob.PubName(), sh.handleSyncVideoMetadata},
		{models.DailyProgHistoryJob.PubName(), sh.handleInsertDailyProgHistory},
	}
	for _, sub := range subscriptions {
		_, err := sh.nats.QueueSubscribe(sub.topic, "middleware", func(msg *nats.Msg) {
			sub.fn(sh.ctx, msg)
		})
		if err != nil {
			logger().Fatalf("Error subscribing to NATS topic %s: %v", sub.topic, err)
			return err
		}
	}

	return nil
}

func (sh *ServiceHandler) handleInsertDailyProgHistory(ctx context.Context, msg *nats.Msg) {
	contxt, cancel := context.WithTimeout(ctx, CANCEL_TIMEOUT)
	defer cancel()
	var body map[string]any
	if err := json.Unmarshal(msg.Data, &body); err != nil {
		logger().Errorf("failed to unmarshal message: %v", err)
		return
	}
	jobId, ok := body["job_id"].(string)
	if !ok {
		logger().Errorf("failed to parse job_id: %v", body["job_id"])
		return
	}
	success := InsertDailyProgHistory(contxt, sh.db) != nil
	sh.cleanupJob(contxt, nil, jobId, success)
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
	params := service.GetJobParams()
	jobId := params["job_id"].(string)
	providerPlatformId := int(params["provider_platform_id"].(float64))
	success := service.ImportCourses(sh.db) != nil
	sh.cleanupJob(contxt, &providerPlatformId, jobId, success)
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
	kiwixService := NewKiwixService(provider, body)
	success := kiwixService.ImportLibraries(contxt, sh.db) != nil
	providerIdPtr := int(provider.ID)
	sh.cleanupJob(contxt, &providerIdPtr, jobId, success)
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
	params := service.GetJobParams()
	jobId := params["job_id"].(string)
	providerPlatformId := int(params["provider_platform_id"].(float64))
	usersMap, err := sh.lookupUserMapping(params)
	if err != nil {
		sh.cleanupJob(contxt, &providerPlatformId, jobId, false)
	}
	coursesMap, err := sh.lookupCoursesMapping(providerPlatformId)
	if err != nil {
		sh.cleanupJob(contxt, &providerPlatformId, jobId, false)
	}
	success := true
	lastRunStr := params["last_run"].(string)
	lastRun, err := time.Parse(time.RFC3339, lastRunStr)
	if err != nil {
		sh.cleanupJob(contxt, &providerPlatformId, jobId, false)
		return
	}
	for _, course := range coursesMap {
		select {
		case <-contxt.Done():
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
	sh.cleanupJob(contxt, &providerPlatformId, jobId, success)
}

func (sh *ServiceHandler) handleAcitivityForCourse(ctx context.Context, msg *nats.Msg) {
	contxt, cancel := context.WithTimeout(ctx, CANCEL_TIMEOUT)
	defer cancel()
	service, err := sh.initProviderPlatformService(contxt, msg)
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
		sh.cleanupJob(contxt, &providerPlatformId, jobId, false)
		return
	}
	for _, course := range courses {
		select {
		case <-contxt.Done():
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
	sh.cleanupJob(contxt, &providerPlatformId, jobId, success)
}

func (sh *ServiceHandler) handleAddVideos(ctx context.Context, msg *nats.Msg) {
	contxt, cancel := context.WithTimeout(ctx, 120*time.Minute)
	defer cancel()
	provider, body, err := sh.getContentProvider(msg)
	if err != nil {
		logger().Errorf("error fetching provider from msg parameters %v", err)
		return
	}
	ytService := NewVideoService(provider, sh.db, body)
	err = ytService.addVideos(contxt)
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
	ytService := NewVideoService(provider, sh.db, body)
	videoId, ok := body["video_id"].(float64)
	if ok {
		err = ytService.retrySingleVideo(contxt, int(videoId))
		if err != nil {
			logger().Errorf("error retrying single video: %v", err)
		}
		return
	}
	logger().Errorf("video_id not found in body")
}

func (sh *ServiceHandler) handleRetryFailedVideos(ctx context.Context, msg *nats.Msg) {
	logger().Infof("Retrying failed videos")
	contxt, cancel := context.WithTimeout(ctx, VIDEO_CANCEL_TIMEOUT)
	success := true
	defer cancel()
	provider, body, err := sh.getContentProvider(msg)
	if err != nil {
		logger().Errorf("error fetching provider from msg parameters %v", err)
		return
	}
	ytService := NewVideoService(provider, sh.db, body)
	err = ytService.retryFailedVideos(contxt)
	if err != nil {
		logger().Errorf("error retrying failed videos: %v", err)
		success = false
	}
	providerIdPtr := int(provider.ID)
	sh.cleanupJob(contxt, &providerIdPtr, body["job_id"].(string), success)
}

func (sh *ServiceHandler) handleSyncVideoMetadata(ctx context.Context, msg *nats.Msg) {
	logger().Infof("Syncing video metadata")
	contxt, cancel := context.WithTimeout(ctx, CANCEL_TIMEOUT)
	defer cancel()
	success := true
	provider, body, err := sh.getContentProvider(msg)
	if err != nil {
		logger().Errorf("error fetching provider from msg parameters %v", err)
		return
	}
	ytService := NewVideoService(provider, sh.db, body)
	err = ytService.syncVideoMetadata(contxt)
	if err != nil {
		logger().Errorf("error syncing video metadata: %v", err)
		success = false
	}
	providerIdPtr := int(provider.ID)
	sh.cleanupJob(contxt, &providerIdPtr, body["job_id"].(string), success)
}
