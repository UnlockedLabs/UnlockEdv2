package handlers

import (
	db "Go-Prototype/backend/cmd/database"
	"context"
	"encoding/json"
	"log"
	"math"
	"net/http"
	"os"
	"strconv"
)

type Server struct {
	Db     *db.DB
	Logger *log.Logger
	Mux    *http.ServeMux
}

func NewServer(isTesting bool) *Server {
	logfile := os.Stdout
	if isTesting {
		return &Server{Db: db.InitDB(true), Logger: log.New(logfile, "Server: ", log.LstdFlags), Mux: http.NewServeMux()}
	} else {
		if os.Getenv("APP_ENV") == "prod" {
			logfile, err := os.OpenFile("logs/server.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
			if err != nil {
				file, err := os.Create("logs/server.log")
				if err != nil {
					log.Fatalf("Error creating log file: %v", err)
				}
				logfile = file
			}
			defer logfile.Close()
		}
		return &Server{Db: db.InitDB(false), Logger: log.New(logfile, "LOG_: ", log.Ldate|log.Ltime|log.Lshortfile), Mux: http.NewServeMux()}
	}
}

func (srv *Server) LogInfo(message string) {
	srv.Logger.Printf("INFO: %v", message)
}

func (srv *Server) LogError(message string) {
	srv.Logger.Printf("ERROR: %v", message)
}

func (srv *Server) LogDebug(message string) {
	srv.Logger.Printf("DEBUG: %v", message)
}

func (srv *Server) ApplyMiddleware(h http.Handler) http.Handler {
	return srv.AuthMiddleware(srv.UserActivityMiddleware(h))
}

func (srv *Server) ApplyAdminMiddleware(h http.Handler) http.Handler {
	return srv.ApplyMiddleware(srv.AdminMiddleware(h))
}

func (srv *Server) TestAsAdmin(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		testClaims := &Claims{
			UserID:   1,
			Username: "SuperAdmin",
			Role:     "admin",
		}
		ctx := context.WithValue(r.Context(), ClaimsKey, testClaims)
		h.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (srv *Server) TestAsUser(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		testClaims := &Claims{
			UserID:   2,
			Username: "testuser",
			Role:     "student",
		}
		ctx := context.WithValue(r.Context(), ClaimsKey, testClaims)
		h.ServeHTTP(w, r.WithContext(ctx))
	})
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
	srv.RegisterActionsRoutes()
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
	return json.NewEncoder(w).Encode(data)
}

func (srv *Server) ErrorResponse(w http.ResponseWriter, status int, message string) {
	srv.Logger.Printf("Error: %v", message)
	http.Error(w, message, status)
}

func (srv *Server) CalculateLast(total int64, perPage int) int {
	if perPage == 0 {
		return 0
	}
	return int(math.Ceil(float64(total) / float64(perPage)))
}
