package handlers

import (
	db "backend/database"
	"encoding/json"
	"log"
	"math"
	"net/http"
	"strconv"
)

type Server struct {
	Db     *db.DB
	Logger *log.Logger
	Mux    *http.ServeMux
}

func NewServer(db *db.DB, logger *log.Logger, mux *http.ServeMux) *Server {
	s := &Server{
		Db:     db,
		Logger: logger,
		Mux:    mux,
	}
	return s
}

func (srv *Server) ApplyMiddleware(h http.Handler) http.Handler {
	return srv.AuthMiddleware(srv.UserActivityMiddleware(h))
}

/**
* Register all API routes here
**/
func (srv *Server) RegisterRoutes() {
	srv.RegisterAuthRoutes()
	srv.RegisterUserRoutes()
	srv.RegisterProviderPlatformRoutes()
	srv.RegisterUserActivityRoutes()
	srv.RegisterProviderMappingRoutes()
}

func (srv *Server) GetPaginationInfo(r *http.Request) (int, int) {
	page := r.URL.Query().Get("page")
	perPage := r.URL.Query().Get("per_page")
	if page == "" {
		page = "1"
	}
	if perPage == "" {
		perPage = "10"
	}
	intPage, err := strconv.Atoi(page)
	if err != nil {
		intPage = 1
	}
	intPerPage, err := strconv.Atoi(perPage)
	if err != nil {
		intPerPage = 10
	}
	return intPage, intPerPage
}

func (srv *Server) WriteResponse(w http.ResponseWriter, status int, data interface{}) error {
	srv.Logger.Printf("Response written: %v", data)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	return json.NewEncoder(w).Encode(data)
}

func (srv *Server) ErrorResponse(w http.ResponseWriter, status int, message string) {
	srv.Logger.Printf("Error: %v", message)
	w.WriteHeader(status)
	http.Error(w, message, status)
}

func (srv *Server) CalculateLast(total int64, perPage int) int {
	if perPage == 0 {
		return 0
	}
	return int(math.Ceil(float64(total) / float64(perPage)))
}
