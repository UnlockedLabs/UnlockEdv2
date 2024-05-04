package handlers

import (
	db "Go-Prototype/backend/cmd/database"
	"context"
	"encoding/json"
	"log"
	"log/slog"
	"math"
	"net/http"
	"os"
	"strconv"
)

type Server struct {
	Db     *db.DB
	Logger *slog.Logger
	Mux    *http.ServeMux
}

/**
* Register all API routes here
**/
func (srv *Server) RegisterRoutes() {
	srv.registerAuthRoutes()
	srv.registerUserRoutes()
	srv.registerProviderPlatformRoutes()
	srv.registerUserActivityRoutes()
	srv.registerProviderMappingRoutes()
	srv.registerActionsRoutes()
	srv.registerLeftMenuRoutes()
	srv.registerImageRoutes()
	srv.registerProgramsRoutes()
	srv.registerMilestonesRoutes()
}

func NewServer(isTesting bool) *Server {
	logfile := os.Stdout
	if isTesting {
		return &Server{Db: db.InitDB(true), Logger: slog.Default(), Mux: http.NewServeMux()}
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
		db := db.InitDB(false)
		mux := http.NewServeMux()
		server := Server{Db: db, Logger: slog.New(slog.NewTextHandler(logfile, nil)), Mux: mux}
		server.RegisterRoutes()
		return &server
	}
}

func (srv *Server) LogInfo(message string) {
	srv.Logger.Info("INFO: ", "%v", message)
}

func (srv *Server) LogError(message string) {
	srv.Logger.Error("ERROR: ", "%v", message)
}

func (srv *Server) LogDebug(message string) {
	srv.Logger.Debug("DEBUG: ", "%v", message)
}

func (srv *Server) applyMiddleware(h http.Handler) http.Handler {
	return srv.AuthMiddleware(srv.UserActivityMiddleware(h))
}

func (srv *Server) applyAdminMiddleware(h http.Handler) http.Handler {
	return srv.applyMiddleware(srv.adminMiddleware(h))
}

func CorsMiddleware(h http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", os.Getenv("FRONTEND_URL"))
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Length, X-Requested-With")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		h.ServeHTTP(w, r)
	}
}

func (srv *Server) TestAsAdmin(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		testClaims := &Claims{
			UserID:        1,
			PasswordReset: false,
			Role:          "admin",
		}
		ctx := context.WithValue(r.Context(), ClaimsKey, testClaims)
		h.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (srv *Server) TestAsUser(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		testClaims := &Claims{
			UserID:        2,
			Role:          "student",
			PasswordReset: false,
		}
		ctx := context.WithValue(r.Context(), ClaimsKey, testClaims)
		h.ServeHTTP(w, r.WithContext(ctx))
	})
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
	if resp, ok := data.(string); ok {
		_, err := w.Write([]byte(resp))
		return err
	}
	return json.NewEncoder(w).Encode(data)
}

func (srv *Server) ErrorResponse(w http.ResponseWriter, status int, message string) {
	srv.LogError(message)
	http.Error(w, message, status)
}

func (srv *Server) CalculateLast(total int64, perPage int) int {
	if perPage == 0 {
		return 0
	}
	return int(math.Ceil(float64(total) / float64(perPage)))
}
