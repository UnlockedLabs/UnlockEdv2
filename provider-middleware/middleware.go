package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"
)

type ServiceIDX string

const IDX ServiceIDX = "idx"

func (srv *ServiceHandler) applyMiddleware(h http.Handler) http.Handler {
	return srv.authMiddleware(srv.passIDMiddleware(h))
}

func (sh *ServiceHandler) initService(id int) error {
	provider, err := sh.LookupProvider(id)
	log.Println("InitService called")
	if err != nil {
		log.Printf("Error: %v", err)
		return fmt.Errorf("failed to find provider: %v", err)
	}
	if provider.Type == "kolibri" {
		service := NewKolibriService(provider)
		if err := service.InitiateSession(); err != nil {
			log.Printf("Failed to initiate session: %v", err)
			return fmt.Errorf("failed to initiate session: %v", err)
		}
		ticker := time.NewTicker(5 * time.Minute)
		done := make(chan bool)
		go func() {
			for {
				select {
				case <-done:
					ticker.Stop()
					return
				case <-ticker.C:
					err := service.RefreshSession()
					if err != nil {
						log.Printf("Failed to refresh session: %v", err)
					} else {
						log.Println("Session refreshed successfully.")
					}
				}
			}
		}()
		sh.mutex.Lock()
		sh.services = append(sh.services, service)
		sh.mutex.Unlock()
		return nil
	} else {
		canvas := newCanvasService(provider)
		sh.mutex.Lock()
		sh.services = append(sh.services, canvas)
		sh.mutex.Unlock()
		return nil
	}
}

func (sh *ServiceHandler) findService(id int) int {
	for idx, service := range sh.services {
		if service.GetID() == id {
			return idx
		}
	}
	return -1
}

func (sh *ServiceHandler) getService(r *http.Request) ProviderServiceInterface {
	idx := r.Context().Value(IDX).(int)
	return sh.services[idx]
}

func (sh *ServiceHandler) passIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(r.URL.Query().Get("id"))
		if err != nil {
			log.Println("Failed to parse ID")
		}
		idx := sh.findService(id)
		if idx == -1 {
			err := sh.initService(id)
			if err != nil {
				log.Println("Failed to initialize service")
				http.Error(w, "Failed to initialize service", http.StatusNotFound)
			}
			// return the index of the last appended service
			idx = len(sh.services) - 1
		}
		ctx := context.WithValue(r.Context(), IDX, idx)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
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
