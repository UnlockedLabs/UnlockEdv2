package main

import (
	"context"
	"log"
	"net/http"
	"strconv"
)

func (sh *ServiceHandler) registerRoutes() {
	sh.Mux.Handle("/", sh.applyMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})))
	sh.Mux.Handle("POST /api/add-provider", sh.authMiddleware(http.HandlerFunc(sh.handleAddProvider)))
	sh.Mux.Handle("GET /api/users", sh.applyMiddleware(http.HandlerFunc(sh.handleUsers)))
	sh.Mux.Handle("GET /api/programs", sh.applyMiddleware(http.HandlerFunc(sh.handlePrograms)))
	sh.Mux.Handle("POST /api/milestones", sh.applyMiddleware(http.HandlerFunc(sh.handleMilestonesForProgramUser)))
}

type ServiceIDX string

const IDX ServiceIDX = "idx"

func (srv *ServiceHandler) applyMiddleware(h http.Handler) http.Handler {
	return srv.authMiddleware(srv.passIDMiddleware(h))
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
		next.ServeHTTP(w, r)
	})
}
