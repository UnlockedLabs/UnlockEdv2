package main

import (
	"UnlockEdv2/src/models"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/nats-io/nats.go"
	log "github.com/sirupsen/logrus"
)

func (sh *ServiceHandler) initServiceFromRequest(ctx context.Context, r *http.Request) (ProviderServiceInterface, error) {
	id, err := strconv.Atoi(r.URL.Query().Get("id"))
	if err != nil {
		log.Printf("Error: %v", err)
		return nil, fmt.Errorf("failed to find provider: %v", err)
	}
	provider, err := sh.LookupProvider(ctx, id)
	if err != nil {
		log.Printf("Error: %v", err)
		return nil, fmt.Errorf("failed to find provider: %v", err)
	}
	switch provider.Type {
	case models.Kolibri:
		return NewKolibriService(provider, nil), nil
	case models.CanvasCloud, models.CanvasOSS:
		return newCanvasService(provider, nil), nil
	}
	return nil, fmt.Errorf("unsupported provider type: %s", provider.Type)
}

func (sh *ServiceHandler) initProviderPlatformService(ctx context.Context, msg *nats.Msg) (ProviderServiceInterface, error) {
	var body map[string]interface{}
	if err := json.Unmarshal(msg.Data, &body); err != nil {
		log.Errorf("failed to unmarshal message: %v", err)
		return nil, fmt.Errorf("failed to unmarshal message: %v", err)
	}
	providerId, ok := body["provider_platform_id"].(float64)
	if !ok {
		return nil, fmt.Errorf("failed to parse provider_platform_id: %v", body["provider_platform_id"])
	}
	jobId, ok := body["job_id"].(string)
	if !ok {
		return nil, fmt.Errorf("failed to parse job_id: %v", body["job_id"])
	}
	// prior to here, we are unable to cleanup the job
	provider, err := sh.LookupProvider(ctx, int(providerId))
	log.Infoln("InitService called")
	if err != nil {
		log.Errorf("error looking up provider platform: %v", err)
		sh.cleanupJob(ctx, int(providerId), jobId, false)
		return nil, fmt.Errorf("failed to find provider: %v", err)
	}
	switch provider.Type {
	case models.Kolibri:
		return NewKolibriService(provider, &body), nil
	case models.CanvasCloud, models.CanvasOSS:
		return newCanvasService(provider, &body), nil
	}
	return nil, fmt.Errorf("unsupported provider type: %s", provider.Type)
}

func (sh *ServiceHandler) initContentProviderService(msg *nats.Msg) (OpenContentProviderServiceInterface, error) {
	var body map[string]interface{}
	if err := json.Unmarshal(msg.Data, &body); err != nil {
		log.Errorf("failed to unmarshal message: %v", err)
		return nil, fmt.Errorf("failed to unmarshal message: %v", err)
	}
	providerId, ok := body["open_content_provider_id"].(float64)
	if !ok {
		return nil, fmt.Errorf("failed to parse open_content_provider_id: %v", body["open_content_provider_id"].(float64))
	}
	openContentProvider, err := sh.LookupOpenContentProvider(int(providerId))
	if err != nil {
		log.Printf("Error looking up content provider: %v", err)
		return nil, fmt.Errorf("failed to find open content provider: %v", err)
	}
	if openContentProvider.Name == models.Kiwix {
		return NewKiwixService(openContentProvider, &body), nil
	}
	return nil, fmt.Errorf("unsupported open content provider type: %s", openContentProvider.Name)
}

func (sh *ServiceHandler) cleanupJob(ctx context.Context, provId int, jobId string, success bool) {
	log.Infof("job %s succeeded?: %v \n cleaning up task", jobId, success)
	var task models.RunnableTask
	if err := sh.db.WithContext(ctx).Model(models.RunnableTask{}).
		Find(&task, "(provider_platform_id = ? AND job_id = ?) OR (open_content_provider_id = ? AND job_id = ?)", provId, jobId, provId, jobId).
		Error; err != nil {
		log.Errorf("failed to fetch task: %v", err)
		return
	}
	task.Status = models.StatusPending
	if success {
		task.LastRun = time.Now()
	}
	if err := sh.db.WithContext(ctx).Save(&task).Error; err != nil {
		log.Errorf("failed to update task: %v", err)
		return
	}
}
