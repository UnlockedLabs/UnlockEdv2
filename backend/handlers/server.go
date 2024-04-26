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
	srv.Mux.HandleFunc("POST /api/login", srv.HandleLogin)
	srv.Mux.Handle("POST /api/logout", srv.ApplyMiddleware(http.HandlerFunc(srv.HandleLogout)))
	srv.Mux.Handle("GET /api/users/{id}/activity", srv.ApplyMiddleware(http.HandlerFunc(srv.GetUserActivityByID)))
	srv.Mux.Handle("GET /api/users/activity", srv.ApplyMiddleware(http.HandlerFunc(srv.GetAllUserActivities)))
	srv.Mux.Handle("GET /api/users", srv.ApplyMiddleware(http.HandlerFunc(srv.IndexUsers)))
	srv.Mux.Handle("GET /api/users/{id}", srv.ApplyMiddleware(http.HandlerFunc(srv.GetUserByID)))
	srv.Mux.Handle("POST /api/users", srv.ApplyMiddleware(http.HandlerFunc(srv.CreateUser)))
	srv.Mux.Handle("PATCH /api/users/{id}", srv.ApplyMiddleware(http.HandlerFunc(srv.UpdateUser)))
	srv.Mux.Handle("DELETE /api/users/{id}", srv.ApplyMiddleware(http.HandlerFunc(srv.DeleteUser)))
	srv.Mux.Handle("GET /api/provider-platforms", srv.ApplyMiddleware(http.HandlerFunc(srv.IndexProviders)))
	srv.Mux.Handle("GET /api/provider-platforms/{id}", srv.ApplyMiddleware(http.HandlerFunc(srv.ShowProvider)))
	srv.Mux.Handle("POST /api/provider-platforms", srv.ApplyMiddleware(http.HandlerFunc(srv.CreateProvider)))
	srv.Mux.Handle("PATCH /api/provider-platforms/{id}", srv.ApplyMiddleware(http.HandlerFunc(srv.UpdateProvider)))
	srv.Mux.Handle("DELETE /api/provider-platforms/{id}", srv.ApplyMiddleware(http.HandlerFunc(srv.DeleteProvider)))
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
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	return json.NewEncoder(w).Encode(data)
}

func (srv *Server) ErrorResponse(w http.ResponseWriter, status int, message string) {
	w.WriteHeader(status)
	http.Error(w, message, status)
}

func (srv *Server) CalculateLast(total int64, perPage int) int {
	if perPage == 0 {
		return 0
	}
	return int(math.Ceil(float64(total) / float64(perPage)))
}
