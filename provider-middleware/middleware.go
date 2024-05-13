package main

import (
	"context"
	"log"
	"net/http"
	"strconv"
)

func (sh *ServiceHandler) RegisterRoutes() {
	sh.Mux.Handle("/", sh.ApplyMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})))
	sh.Mux.Handle("POST /api/add-provider", sh.AuthMiddleware(http.HandlerFunc(sh.HandleAddProvider)))
	sh.Mux.Handle("GET /api/users", sh.ApplyMiddleware(http.HandlerFunc(sh.HandleUsers)))
	sh.Mux.Handle("GET /api/programs", sh.ApplyMiddleware(http.HandlerFunc(sh.HandlePrograms)))
}

type ServiceIDX string

const IDX ServiceIDX = "idx"

func (srv *ServiceHandler) ApplyMiddleware(h http.Handler) http.Handler {
	return srv.AuthMiddleware(srv.PassIDMiddleware(h))
}

func (sh *ServiceHandler) PassIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(r.URL.Query().Get("id"))
		if err != nil {
			log.Println("Failed to parse ID")
		}
		idx := sh.FindService(id)
		if idx == -1 {
			err := sh.InitService(id)
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

func (sh *ServiceHandler) AuthMiddleware(next http.Handler) http.Handler {
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
