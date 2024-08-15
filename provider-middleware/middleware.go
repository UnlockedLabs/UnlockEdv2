package main

import (
	"UnlockEdv2/src/models"
	"fmt"
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *ServiceHandler) applyMiddleware(h http.Handler) http.Handler {
	return srv.authMiddleware(h)
}

func (sh *ServiceHandler) initService(r *http.Request) (ProviderServiceInterface, error) {
	id, err := strconv.Atoi(r.URL.Query().Get("id"))
	if err != nil {
		log.Error("GET Provider handler Error: ", err.Error())
		return nil, err
	}
	provider, err := sh.LookupProvider(id)
	log.Println("InitService called")
	if err != nil {
		log.Printf("Error: %v", err)
		return nil, fmt.Errorf("failed to find provider: %v", err)
	}
	switch provider.Type {
	case models.Kolibri:
		return NewKolibriService(provider), nil
	case models.CanvasCloud, models.CanvasOSS:
		return newCanvasService(provider), nil
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
