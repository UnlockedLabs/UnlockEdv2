package main

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/nats-io/nats.go"
	log "github.com/sirupsen/logrus"
)

func (srv *ServiceHandler) applyMiddleware(h http.Handler) http.Handler {
	return srv.authMiddleware(h)
}

func (sh *ServiceHandler) initServiceFromRequest(r *http.Request) (ProviderServiceInterface, error) {
	id, err := strconv.Atoi(r.URL.Query().Get("id"))
	provider, err := sh.LookupProvider(id)
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

func (sh *ServiceHandler) initService(msg *nats.Msg) (ProviderServiceInterface, error) {
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
	provider, err := sh.LookupProvider(int(providerId))
	log.Println("InitService called")
	if err != nil {
		log.Printf("Error: %v", err)
		sh.cleanupJob(int(providerId), jobId, false)
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

func (sh *ServiceHandler) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		checkHeader := r.Header.Get("Authorization")
		if checkHeader == "" || checkHeader != sh.token {
			log.Println("Authorization failure")
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r.WithContext(r.Context()))
	})
}

func (sh *ServiceHandler) cleanupJob(provId int, jobId string, success bool) {
	log.Println("handling job failure")
	var task models.RunnableTask
	if err := sh.db.Model(models.RunnableTask{}).Find(&task, "provider_platform_id = ? AND job_id = ?", provId, jobId).Error; err != nil {
		log.Errorf("failed to fetch task: %v", err)
		return
	}
	// set the task status back to pending but we don't
	// update the last run time so that the next run can include the
	// relevant data from the failed run
	task.Status = models.StatusPending
	if err := sh.db.Save(&task).Error; err != nil {
		log.Errorf("failed to update task: %v", err)
		return
	}
}
