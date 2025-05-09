package handlers

import (
	database "UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"reflect"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/nats-io/nats.go"
	ory "github.com/ory/kratos-client-go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	log "github.com/sirupsen/logrus"
)

type Server struct {
	Db        *database.DB
	Mux       *http.ServeMux
	OryClient *ory.APIClient
	Client    *http.Client
	nats      *nats.Conn
	dev       bool
	buckets   map[string]nats.KeyValue
	features  []models.FeatureAccess
	s3        *s3.Client
	presigner *s3.PresignClient
	s3Bucket  string
	wsClient  *ClientManager
}

type routeDef struct {
	routeMethod string
	handler     HttpFunc
	admin       bool
	features    []models.FeatureAccess
}

func (srv *Server) register(routes func() []routeDef) {
	for _, route := range routes() {
		if route.admin {
			srv.Mux.Handle(route.routeMethod, srv.applyAdminMiddleware(route.handler, route.features...))
		} else {
			srv.Mux.Handle(route.routeMethod, srv.applyMiddleware(route.handler, route.features...))
		}
	}
}

/**
* Register all API routes right here
**/
func (srv *Server) RegisterRoutes() {
	/* register special routes */
	srv.registerProxyRoutes()
	srv.registerImageRoutes()
	srv.registerWebsocketRoute()
	srv.Mux.Handle("/api/metrics", promhttp.Handler())
	srv.Mux.HandleFunc("/api/healthcheck", func(w http.ResponseWriter, r *http.Request) {
		if _, err := w.Write([]byte("OK")); err != nil {
			log.Errorln("Error writing healthcheck response: ", err)
			return
		}
	})
	for _, route := range []func() []routeDef{
		srv.registerLoginFlowRoutes,
		srv.registerAuthRoutes,
		srv.registerUserRoutes,
		srv.registerProviderPlatformRoutes,
		srv.registerProviderMappingRoutes,
		srv.registerActionsRoutes,
		srv.registerLeftMenuRoutes,
		srv.registerCoursesRoutes,
		srv.registerOutcomesRoutes,
		srv.registerActivityRoutes,
		srv.registerOidcRoutes,
		srv.registerDashboardRoutes,
		srv.registerProviderUserRoutes,
		srv.registerOryRoutes,
		srv.registerFacilitiesRoutes,
		srv.registerOpenContentRoutes,
		srv.registerLibraryRoutes,
		srv.registerProgramsRoutes,
		srv.registerClassesRoutes,
		srv.registerClassEventsRoutes,
		srv.registerProgramClassEnrollmentsRoutes,
		srv.registerAttendanceRoutes,
		srv.registerVideoRoutes,
		srv.registerFeatureFlagRoutes,
		srv.registerOpenContentActivityRoutes,
		srv.registerTagRoutes,
		srv.registerAnalyticRoutes,
	} {
		srv.register(route)
	}
}

func init() {
	prometheus.MustRegister(requestCount)
	prometheus.MustRegister(requestDuration)
	prometheus.MustRegister(requestSize)
	prometheus.MustRegister(responseSize)
	prometheus.MustRegister(responseStatus)
	prometheus.MustRegister(errorCount)
}

func (srv *Server) ListenAndServe() {
	port := os.Getenv("APP_PORT")
	if port == "" {
		port = "8080"
	}
	log.Println("Starting server on port: ", port)
	if err := http.ListenAndServe(":"+port, corsMiddleware(srv.Mux)); err != nil {
		log.Fatal(err)
	}
}

func NewServer(isTesting bool) *Server {
	if isTesting {
		return newTestingServer()
	}
	return newServer()
}

func newServer() *Server {
	ctx := context.Background()
	conn, err := setupNats()
	if err != nil {
		log.Errorf("Failed to connect to NATS: %v", err)
	}
	dev := os.Getenv("APP_ENV") == "dev"
	server := Server{
		Db:        database.InitDB(false),
		Mux:       http.NewServeMux(),
		OryClient: ory.NewAPIClient(oryConfig()),
		Client:    &http.Client{},
		nats:      conn,
		dev:       dev,
	}
	features, err := server.Db.GetFeatureAccess()
	if err != nil {
		log.Fatal("Failed to fetch feature flags")
	}
	server.features = features
	err = server.setupNatsKvBuckets()
	if err != nil {
		log.Fatalf("Failed to setup JetStream KV store: %v", err)
	}
	server.initAwsConfig(ctx)
	server.RegisterRoutes()
	if err := server.setupDefaultAdminInKratos(); err != nil {
		log.Fatal("Error setting up default admin in Kratos")
	}
	server.wsClient = newClientManager()
	return &server
}

func (srv *Server) initAwsConfig(ctx context.Context) {
	bucket := os.Getenv("S3_BUCKET_NAME")
	if bucket != "" {
		cfg, err := config.LoadDefaultConfig(ctx)
		if err != nil {
			log.Fatal(err)
		}
		srv.s3 = s3.NewFromConfig(cfg)
		srv.presigner = s3.NewPresignClient(srv.s3)
		srv.s3Bucket = bucket
	}
}

func newTestingServer() *Server {
	db := database.InitDB(true)
	features := models.AllFeatures
	return &Server{
		Db:        db,
		Mux:       http.NewServeMux(),
		OryClient: nil,
		Client:    nil,
		features:  features,
	}
}

func setupNats() (*nats.Conn, error) {
	options := nats.GetDefaultOptions()
	options.Url = os.Getenv("NATS_URL")
	options.User = os.Getenv("NATS_USER")
	options.Password = os.Getenv("NATS_PASSWORD")
	conn, err := options.Connect()
	if err != nil {
		log.Fatalf("Failed to connect to NATS: %v", err)
	}
	return conn, nil
}

func oryConfig() *ory.Configuration {
	return &ory.Configuration{
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
}

const (
	CachedUsers  string = "cache_users"
	LibraryPaths string = "library_paths"
	OAuthState   string = "oauth_state"
	LoginMetrics string = "login_metrics"
	AdminLayer2  string = "admin_layer_2"
)

func (srv *Server) setupNatsKvBuckets() error {
	js, err := srv.nats.JetStream()
	if err != nil {
		log.Fatalf("Error initializing JetStream: %v", err)
		return err
	}
	buckets := map[string]nats.KeyValue{}
	for _, bucket := range []string{CachedUsers, LibraryPaths, LoginMetrics, OAuthState, AdminLayer2} {
		kv, err := js.KeyValue(bucket)
		if err != nil {
			cfg := &nats.KeyValueConfig{
				Bucket:  bucket,
				History: 1,
			}
			switch bucket {
			case CachedUsers:
				cfg.TTL = time.Hour * 1
			case OAuthState:
				cfg.TTL = time.Minute * 10
			default:
				cfg.TTL = time.Hour * 24

			}
			kv, err = js.CreateKeyValue(cfg)
			if err != nil {
				log.Errorf("Error creating JetStream KV store: %v", err)
				return err
			}
		}
		buckets[bucket] = kv
	}
	srv.buckets = buckets
	return nil
}

func (srv *Server) hasFeatureAccess(axx ...models.FeatureAccess) bool {
	for _, a := range axx {
		if !slices.Contains(srv.features, a) {
			return false
		}
	}
	return true
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
		log.Println("no KOLIBRI_URL set, not registering new OIDC client")
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
		}
		err = srv.Db.CreateProviderPlatform(provider)
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
	return srv.Db.Create(client).Error
}

func (srv *Server) syncKratosAdminDB() error {
	id, err := srv.checkForAdminInKratos()
	if err != nil {
		return err
	}
	if id == "" {
		// this means the default admin was just created, so we use default password
		err := srv.generateKolibriOidcClient()
		if err != nil {
			log.Warn("KOLIBRI_URL was set but failed to generate OIDC client for kolibri")
		}
		if err := srv.HandleCreateUserKratos("SuperAdmin", "ChangeMe!"); err != nil {
			return err
		}
		return nil
	} else {
		// the admin acct exists in kratos already
		user, err := srv.Db.GetSystemAdmin()
		if err != nil {
			log.Fatal("this should never happen, we just created the user")
		}
		if user.KratosID != id {
			if err := srv.Db.Exec("UPDATE users SET kratos_id = ? WHERE id = 1", id).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func (srv *Server) setupDefaultAdminInKratos() error {
	user, err := srv.Db.GetSystemAdmin()
	if err != nil {
		srv.Db.SeedDefaultData(false)
		return srv.setupDefaultAdminInKratos()
		// rerun after seeding the default user
	}
	if user.KratosID != "" {
		// double check that the stored kratos ID is valid
		if err := srv.validateUserIDKratos(user.KratosID); err != nil {
			// if not, it's a freshly migrated database
			// so we create the OIDC client if KOLIBRI_URL is set
			// then create the default admin in kratos
			log.Println("kratos id not found")
			return srv.HandleCreateUserKratos(user.Username, "ChangeMe!")
		}
	}
	return srv.syncKratosAdminDB()
}

func (srv *Server) getFacilityID(r *http.Request) uint {
	return r.Context().Value(ClaimsKey).(*Claims).FacilityID
}

func (srv *Server) getUserID(r *http.Request) uint {
	return r.Context().Value(ClaimsKey).(*Claims).UserID
}

type TestClaims string

const TestingClaimsKey TestClaims = "test_claims"

func (srv *Server) isTesting(r *http.Request) bool {
	return r.Context().Value(TestingClaimsKey) != nil
}

func (srv *Server) createContentActivityAndNotifyWS(urlString string, activity *models.OpenContentActivity) {
	srv.Db.CreateContentActivity(urlString, activity)
	if activity.ID > 0 {
		srv.wsClient.notifyUser(WsMsg{EventType: VisitEvent, UserID: activity.UserID, Msg: MsgContent{ActivityID: activity.ID}})
		if !strings.HasPrefix(urlString, "/viewer/videos") {
			var (
				bookmark models.OpenContentFavorite
				wsMsg    MsgContent
			)
			if srv.Db.Model(&models.OpenContentFavorite{}).Where("user_id = ? AND content_id = ? AND open_content_url_id = ?", activity.UserID, activity.ContentID, activity.OpenContentUrlID).First(&bookmark).RowsAffected > 0 {
				wsMsg = MsgContent{Msg: "true"}
			} else {
				wsMsg = MsgContent{Msg: "false"}
			}
			srv.wsClient.notifyUser(WsMsg{EventType: BookmarkEvent, UserID: activity.UserID, Msg: wsMsg})
		}
	}
}

func (srv *Server) getPagedHistoryEvents(id int, tableName string, args *models.QueryContext, log sLog) (models.PaginationMeta, []models.ActivityHistoryResponse, error) {
	var (
		userIDs            []uint
		paginationMeta     models.PaginationMeta
		pagedHistoryEvents []models.ActivityHistoryResponse
	)
	programClassesHistory, err := srv.Db.GetProgramClassesHistory(id, tableName, args)
	if err != nil {
		return paginationMeta, nil, newDatabaseServiceError(err)
	}
	programHistoryEvents := make([]models.ActivityHistoryResponse, 0)
	for _, history := range programClassesHistory {
		historyEvents, userID, err := history.ConvertAndCompare()
		if err != nil {
			log.errorf("error occurred while converting activity history events, error is %v", err)
			continue
		}
		programHistoryEvents = append(programHistoryEvents, historyEvents...)
		if userIDs == nil || !slices.Contains(userIDs, userID) {
			userIDs = append(userIDs, userID)
		}
	}
	if len(userIDs) > 0 {
		users, err := srv.Db.GetUsersByIDs(userIDs, args)
		if err != nil {
			return paginationMeta, nil, newDatabaseServiceError(err)
		}
		for i := range programHistoryEvents {
			index := slices.IndexFunc(users, func(u models.User) bool {
				return u.ID == programHistoryEvents[i].UserID
			})
			if index != -1 {
				programHistoryEvents[i].AdminUsername = &users[index].Username
			}
		}
	}
	totalHistoryEvents := len(programHistoryEvents)
	if totalHistoryEvents > 0 {
		paginationMeta = models.NewPaginationInfo(args.Page, args.PerPage, int64(totalHistoryEvents))
		start := args.CalcOffset()
		end := start + args.PerPage
		if end > totalHistoryEvents {
			end = totalHistoryEvents
		}
		pagedHistoryEvents = programHistoryEvents[start:end]
	} else {
		paginationMeta = models.NewPaginationInfo(args.Page, args.PerPage, 1)
	}
	if totalHistoryEvents == 0 || (int64(args.Page) == int64(paginationMeta.LastPage) && len(pagedHistoryEvents) < args.PerPage) {
		var (
			createdByDetails models.ActivityHistoryResponse
		)
		switch tableName {
		case "programs":
			createdByDetails, err = srv.Db.GetProgramCreatedAtAndBy(id, args)
			if err != nil {
				return paginationMeta, nil, newDatabaseServiceError(err)
			}
			createdByDetails.FieldName = "program"
		case "program_classes":
			createdByDetails, err = srv.Db.GetClassCreatedAtAndBy(id, args)
			if err != nil {
				return paginationMeta, nil, newDatabaseServiceError(err)
			}
			createdByDetails.FieldName = "class"
		default:
			return paginationMeta, nil, newBadRequestServiceError(errors.New("table name not recognized"), fmt.Sprintf("table name %s not recognized", tableName))
		}
		createdByDetails.Action = models.PrgClassHistory
		pagedHistoryEvents = append(pagedHistoryEvents, createdByDetails)
		//count this record only if there are history events
		if totalHistoryEvents > 0 {
			paginationMeta.Total++
		}
	}
	return paginationMeta, pagedHistoryEvents, nil
}

func (srv *Server) getPaginationInfo(r *http.Request) (int, int) {
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

type HttpFunc func(w http.ResponseWriter, r *http.Request, log sLog) error

// Wraps a handler function that returns an error so that it can handle the error by writing it to the response and logging it.
func (svr *Server) handleError(handler HttpFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log := sLog{f: log.Fields{"handler": getHandlerName(handler), "method": r.Method, "path": r.URL.Path}}
		claims, ok := r.Context().Value(ClaimsKey).(*Claims)
		audit := false
		if ok {
			if claims.isAdmin() && r.Method != http.MethodGet {
				audit = true
				ip := r.Header.Get("X-Forwarded-For")
				if ip == "" {
					ip = r.RemoteAddr
				} else {
					ip = strings.Split(ip, ",")[0]
				}
				log.add("admin_id", claims.UserID)
				log.add("username", claims.Username)
				log.add("role", claims.Role)
				log.add("session_id", claims.SessionID)
				log.add("facility_id", claims.FacilityID)
				log.add("facility_name", claims.FacilityName)
				log.add("ip_address", ip)
			}
		}
		if err := handler(w, r, log); err != nil {
			if svcErr, ok := err.(serviceError); ok {
				svr.errorResponse(w, svcErr.Status, svcErr.Message)
				log.error("Error occurred is ", svcErr.Err)
			} else { //capture all other error types
				svr.errorResponse(w, http.StatusInternalServerError, err.Error())
				log.error("Error occurred is ", err.Error())
			}
		}
		if audit {
			log.adminAudit()
		}
	})
}

// Uses reflection to get the name of the handler function using a series of string splits
func getHandlerName(handler HttpFunc) string {
	handlerName := runtime.FuncForPC(reflect.ValueOf(handler).Pointer()).Name()
	hyphenSplit := strings.Split(handlerName, "-")
	if len(hyphenSplit) != 2 {
		return "NameNotFound"
	}
	periodSplit := strings.Split(hyphenSplit[0], ".")
	if len(periodSplit) != 3 {
		return "NameNotFound"
	}
	return periodSplit[2]
}

func writePaginatedResponse[T any](w http.ResponseWriter, status int, data []T, meta models.PaginationMeta) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	resp := models.PaginatedResource[T]{Message: "", Data: data, Meta: meta}
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		return newResponseServiceError(err)
	}
	return nil
}

func writeJsonResponse[T any](w http.ResponseWriter, status int, data T) error {
	if any(data) == nil {
		w.WriteHeader(status)
		return nil
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if str, ok := any(data).(string); ok {
		resp := models.Resource[struct{}]{Message: str, Data: struct{}{}}
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			return newResponseServiceError(err)
		}
		return nil
	}
	resp := models.Resource[T]{Message: "Data fetched successfully", Data: data}
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		return newResponseServiceError(err)
	}
	return nil
}

func (srv *Server) errorResponse(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	resource := models.Resource[any]{Message: message}
	err := json.NewEncoder(w).Encode(resource)
	if err != nil {
		log.Error("error writing error response: ", err)
		http.Error(w, message, status)
	}
}
