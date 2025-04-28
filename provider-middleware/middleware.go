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
	var provider models.ProviderPlatform
	err = sh.db.WithContext(ctx).First(&provider, "id = ?", id).Error
	if err != nil {
		log.Println("Failed to find provider")
		return nil, err
	}
	switch provider.Type {
	case models.Kolibri:
		return NewKolibriService(&provider, nil), nil
	case models.CanvasCloud, models.CanvasOSS:
		return newCanvasService(&provider, nil), nil
	case models.Brightspace:
		return newBrightspaceService(&provider, sh.db, nil)
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
	providerIdPtr := int(providerId)
	var provider models.ProviderPlatform
	err := sh.db.WithContext(ctx).First(&provider, "id = ?", providerIdPtr).Error
	if err != nil {
		log.Errorf("error looking up provider platform: %v", err)
		sh.cleanupJob(ctx, &providerIdPtr, jobId, false)
		return nil, fmt.Errorf("failed to find provider: %v", err)
	}
	switch provider.Type {
	case models.Kolibri:
		return NewKolibriService(&provider, &body), nil
	case models.CanvasCloud, models.CanvasOSS:
		return newCanvasService(&provider, &body), nil
	case models.Brightspace:
		return newBrightspaceService(&provider, sh.db, &body)
	}
	return nil, fmt.Errorf("unsupported provider type: %s", provider.Type)
}

func (sh *ServiceHandler) getContentProvider(msg *nats.Msg) (*models.OpenContentProvider, map[string]interface{}, error) {
	var body map[string]interface{}
	if err := json.Unmarshal(msg.Data, &body); err != nil {
		log.Errorf("failed to unmarshal message: %v", err)
		return nil, nil, fmt.Errorf("failed to unmarshal message: %v", err)
	}
	providerId, ok := body["open_content_provider_id"].(float64)
	if !ok {
		return nil, body, fmt.Errorf("failed to parse open_content_provider_id: %v", body["open_content_provider_id"].(float64))
	}
	openContentProvider, err := sh.LookupOpenContentProvider(int(providerId))
	if err != nil {
		log.Printf("Error looking up content provider: %v", err)
		return nil, body, fmt.Errorf("failed to find open content provider: %v", err)
	}
	return openContentProvider, body, nil
}

func (sh *ServiceHandler) cleanupJob(ctx context.Context, provId *int, jobId string, success bool) {
	log.Infof("job %s succeeded?: %v \n cleaning up task", jobId, success)
	var task models.RunnableTask
	tx := sh.db.WithContext(ctx).Model(models.RunnableTask{})
	if provId != nil {
		tx = tx.Where("(provider_platform_id = ? AND job_id = ?) OR (open_content_provider_id = ? AND job_id = ?)", *provId, jobId, *provId, jobId)
	} else {
		tx = tx.Where("job_id = ?", jobId)
	}
	if err := tx.
		First(&task).
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
