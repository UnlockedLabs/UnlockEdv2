package handlers

import (
	database "UnlockEdv2/src/database"
	"context"
	"encoding/json"
	"math"
	"net/http"
	"os"
	"strconv"

	ory "github.com/ory/kratos-client-go"
	log "github.com/sirupsen/logrus"
)

type Server struct {
	Db        *database.DB
	Mux       *http.ServeMux
	OryClient *ory.APIClient
	Client    *http.Client
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
	srv.registerDashboardRoutes()
	srv.registerOidcFlowRoutes()
	srv.registerProviderUserRoutes()
}

func ServerWithDBHandle(db *database.DB) *Server {
	return &Server{Db: db, Mux: http.NewServeMux()}
}

func NewServer(isTesting bool) *Server {
	if isTesting {
		db := database.InitDB(true)
		return &Server{Db: db, Mux: http.NewServeMux(), OryClient: nil, Client: nil}
	} else {
		configuration := ory.NewConfiguration()
		configuration.Scheme = "http"
		configuration.Host = os.Getenv("KRATOS_URL")
		configuration.Servers = []ory.ServerConfiguration{
			{
				URL: os.Getenv("KRATOS_PUBLIC_URL"),
			},
		}
		apiClient := ory.NewAPIClient(configuration)
		db := database.InitDB(false)
		mux := http.NewServeMux()
		server := Server{Db: db, Mux: mux, OryClient: apiClient, Client: &http.Client{}}
		server.RegisterRoutes()
		if err := server.setupDefaultAdminInKratos(); err != nil {
			log.Fatal("Error setting up default admin in Kratos")
		}
		return &server
	}
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

func (srv *Server) setupDefaultAdminInKratos() error {
	user := srv.Db.GetUserByUsername("SuperAdmin")
	if user == nil {
		log.Println("SuperAdmin not found in database, this shouldn't happen")
		database.SeedDefaultData(srv.Db.Conn)
		// rerun after seeding the default user
		if err := srv.setupDefaultAdminInKratos(); err != nil {
			return err
		}
	}
	if user.KratosID == "" {
		if err := srv.handleCreateUserKratos("SuperAdmin", "ChangeMe!"); err != nil {
			log.Println("Error creating SuperAdmin in Kratos")
			return err
		}
	}
	return nil
}

type TestClaims string

const TestingClaimsKey = TestClaims("test_claims")

func (srv *Server) isTesting(r *http.Request) bool {
	return r.Context().Value(TestingClaimsKey) != nil
}

func (srv *Server) TestAsAdmin(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		testClaims := &Claims{
			UserID:        1,
			PasswordReset: false,
			Role:          "admin",
		}
		ctx := context.WithValue(r.Context(), ClaimsKey, testClaims)
		test_ctx := context.WithValue(ctx, TestingClaimsKey, true)
		h.ServeHTTP(w, r.WithContext(test_ctx))
	})
}

func (srv *Server) GetUserID(r *http.Request) uint {
	claims := r.Context().Value(ClaimsKey).(*Claims)
	return claims.UserID
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
	if data == nil {
		return nil
	}
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
