package handlers

import (
	database "UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
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
	srv.registerOryRoutes()
	srv.registerFacilitiesRoutes()
	srv.registerOpenContentRoutes()
}

func ServerWithDBHandle(db *database.DB) *Server {
	return &Server{Db: db, Mux: http.NewServeMux()}
}

func NewServer(isTesting bool) *Server {
	if isTesting {
		db := database.InitDB(true)
		return &Server{Db: db, Mux: http.NewServeMux(), OryClient: nil, Client: nil}
	} else {
		configuration := ory.Configuration{
			Servers: ory.ServerConfigurations{
				{
					URL: os.Getenv("KRATOS_ADMIN_URL"),
				},
				{
					URL: os.Getenv("KRATOS_PUBLIC_URL"),
				},
			},
			DefaultHeader: map[string]string{"Authorization": "Bearer " + os.Getenv("KRATOS_TOKEN")},
		}
		apiClient := ory.NewAPIClient(&configuration)
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

func (srv *Server) applyMiddleware(h func(http.ResponseWriter, *http.Request)) http.HandlerFunc {
	return http.HandlerFunc(srv.AuthMiddleware(srv.UserActivityMiddleware(h)))
}

func (srv *Server) ApplyAdminMiddleware(h func(http.ResponseWriter, *http.Request)) http.HandlerFunc {
	return http.HandlerFunc(srv.applyMiddleware(srv.adminMiddleware(h)))
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

func (srv *Server) checkForAdminInKratos() (string, error) {
	identities, err := srv.handleFindKratosIdentities()
	if err != nil {
		log.Error("unable to get identities in kratos")
		return "", err
	}

	log.Debug("checking for admin in kratos")
	for _, user := range identities {
		if username, ok := user.GetTraitsOk(); ok {
			log.Debug("got traits from ory identity")
			if username != nil {
				deref := *username
				if traits, ok := deref.(map[string]interface{}); !ok {
					log.Debug("cannot deref traits from ory identity")
					return "", nil
				} else {
					if traits["username"].(string) == "SuperAdmin" {
						log.Debug("checking for admin in kratos, found admin with ID:", user.GetId())
						return user.GetId(), nil
					}
				}
			}
		}
	}
	return "", nil
}

func (srv *Server) generateKolibriOidcClient() error {
	fields := log.Fields{"func": "generateKolibriOidcClient"}
	if os.Getenv("KOLIBRI_URL") == "" {
		// there is no kolibri deployment registered
		return nil
	}
	provider, err := srv.Db.FindKolibriInstance()
	if err != nil {
		provider = &models.ProviderPlatform{
			Name:      string(models.Kolibri),
			Type:      models.Kolibri,
			BaseUrl:   os.Getenv("KOLIBRI_URL"),
			AccessKey: os.Getenv("KOLIBRI_USERNAME") + ":" + os.Getenv("KOLIBRI_PASSWORD"),
			AccountID: "TODO", // kolibri wont be running yet. This will be updated the first time a user is added
			State:     models.Enabled,
			IconUrl:   "https://learningequality.org/static/assets/kolibri-ecosystem-logos/blob-logo.svg",
		}
		provider, err = srv.Db.CreateProviderPlatform(provider)
		if err != nil {
			fields["error"] = err.Error()
			log.WithFields(fields).Errorln("error creating kolibri provider")
			return err
		}
	}
	client, _, err := models.OidcClientFromProvider(provider, false, srv.Client)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Errorln("error creating kolibri auth client")
		return err
	}
	return srv.Db.Conn.Create(client).Error
}

func (srv *Server) syncKratosAdminDB() error {
	id, err := srv.checkForAdminInKratos()
	if err != nil {
		return err
	}
	if id == "" {
		// this means the default admin was just created, so we use default password
		if err := srv.HandleCreateUserKratos("SuperAdmin", "ChangeMe!"); err != nil {
			return err
		}
		return nil
	} else {
		// the admin acct exists in kratos already
		user, err := srv.Db.GetUserByID(1)
		if err != nil {
			log.Fatal("this should never happen, we just created the user")
		}
		if user.KratosID != id {
			if err := srv.Db.Conn.Exec("UPDATE users SET kratos_id = ? WHERE id = 1", id).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func (srv *Server) setupDefaultAdminInKratos() error {
	user, err := srv.Db.GetUserByID(1)
	if err != nil {
		database.SeedDefaultData(srv.Db.Conn, false)
		// rerun after seeding the default user
	}
	if user.KratosID != "" {
		// double check that the stored kratos ID is valid
		if err := srv.validateUserIDKratos(user.KratosID); err != nil {
			// if not, it's a freshly migrated database
			// so we create the OIDC client if KOLIBRI_URL is set
			// then create the default admin in kratos
			err := srv.generateKolibriOidcClient()
			if err != nil {
				log.Warn("KOLIBRI_URL was set but failed to generate OIDC client for kolibri")
			}
			return srv.HandleCreateUserKratos(user.Username, "ChangeMe!")
		}
	}
	return srv.syncKratosAdminDB()
}

func (srv *Server) getFacilityID(r *http.Request) uint {
	return r.Context().Value(ClaimsKey).(*Claims).FacilityID
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
			Role:          models.Admin,
			FacilityID:    1,
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
			UserID:        4,
			Role:          models.Student,
			PasswordReset: false,
			FacilityID:    1,
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

func (srv *Server) WriteResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data == nil {
		return
	}
	if resp, ok := data.(string); ok {
		if _, err := w.Write([]byte(resp)); err != nil {
			log.Error("error writing response: ", err)
			return
		}
	}
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Error("Error writing json response", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, "error writing response")
	}
}

func (srv *Server) ErrorResponse(w http.ResponseWriter, status int, message string) {
	log.Error(message)
	resource := models.Resource[interface{}]{Message: message}
	err := json.NewEncoder(w).Encode(resource)
	if err != nil {
		log.Error("error writing error response: ", err)
		http.Error(w, message, status)
	}
}

func (srv *Server) CalculateLast(total int64, perPage int) int {
	if perPage == 0 {
		return 0
	}
	return int(math.Ceil(float64(total) / float64(perPage)))
}
