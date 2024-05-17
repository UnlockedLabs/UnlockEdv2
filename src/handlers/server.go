package handlers

import (
	database "Go-Prototype/src/database"
	"context"
	"encoding/json"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"

	log "github.com/sirupsen/logrus"
)

type Server struct {
	Db  *database.DB
	Mux *http.ServeMux
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
	srv.registerOutcomesRoutes()
	srv.registerActivityRoutes()
	srv.registerOidcRoutes()
}

func ServerWithDBHandle(db *database.DB) *Server {
	return &Server{Db: db, Mux: http.NewServeMux()}
}

func NewServer(isTesting bool) *Server {
	if isTesting {
		return &Server{Db: database.InitDB(true), Mux: http.NewServeMux()}
	} else {
		prod := os.Getenv("APP_ENV") == "prod" || os.Getenv("APP_ENV") == "production"
		db := database.InitDB(false)
		mux := http.NewServeMux()
		server := Server{Db: db, Mux: mux}
		server.RegisterRoutes()
		if prod {
			server.Mux.HandleFunc("GET /", server.ServeFrontend)
		}
		return &server
	}
}

func (srv *Server) ServeFrontend(w http.ResponseWriter, r *http.Request) {
	var p string
	if strings.Contains(r.URL.Path, ".") {
		p = FrontendPath + r.URL.Path
	} else {
		p = IndexPage
	}
	http.ServeFile(w, r.WithContext(r.Context()), p)
}

const (
	FrontendPath = "frontend/dist/"
	IndexPage    = "frontend/dist/index.html"
)

func (srv *Server) applyMiddleware(h http.Handler) http.Handler {
	return srv.AuthMiddleware(srv.UserActivityMiddleware(h))
}

func (srv *Server) applyAdminMiddleware(h http.Handler) http.Handler {
	return srv.applyMiddleware(srv.adminMiddleware(h))
}

func CorsMiddleware(next http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Length, X-Requested-With")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PATCH, PUT, DELETE")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r.WithContext(r.Context()))
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
	log.Error(message)
	http.Error(w, message, status)
}

func (srv *Server) CalculateLast(total int64, perPage int) int {
	if perPage == 0 {
		return 0
	}
	return int(math.Ceil(float64(total) / float64(perPage)))
}
