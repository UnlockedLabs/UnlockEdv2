package integration

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/handlers"
	"UnlockEdv2/src/models"
	"context"
	"log"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

type TestEnv struct {
	Server     *handlers.Server
	TestServer *httptest.Server
	DB         *database.DB
	Client     *Client
	Context    context.Context
	Cancel     context.CancelFunc
	T          *testing.T
}

func SetupTestEnv(t *testing.T) *TestEnv {
	ctx, cancel := context.WithCancel(context.Background())

	server := handlers.NewServer(true, ctx)
	if server == nil {
		t.Fatal("Failed to create test server")
	}

	//SeedTestData(server.Db)
	server.RegisterRoutes()

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		server.Mux.ServeHTTP(w, r)
	}))

	client := NewClient(ts.URL)

	return &TestEnv{
		Server:     server,
		TestServer: ts,
		DB:         server.Db,
		Client:     client,
		Context:    ctx,
		Cancel:     cancel,
		T:          t,
	}
}

func (env *TestEnv) CleanupTestEnv() {
	if env.TestServer != nil {
		env.TestServer.Close()
	}

	if env.Cancel != nil {
		env.Cancel()
	}

	if env.DB == nil || env.DB.DB == nil {
		return
	}

	sqlDb, err := env.DB.DB.DB()
	if err != nil {
		env.T.Errorf("failed to get sql database during cleanup: %v", err)
	}

	if err := sqlDb.Close(); err != nil {
		env.T.Errorf("failed to close sql database during cleanup: %v", err)
	}
}

func (env *TestEnv) WaitForServer(timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", env.TestServer.Listener.Addr().String(), time.Second)
		if err == nil {
			if closeErr := conn.Close(); closeErr != nil {
				env.T.Logf("error closing connection: %v", closeErr)
			}
			return nil
		}
		time.Sleep(100 * time.Millisecond)
	}
	return &net.OpError{
		Op:   "dial",
		Net:  "tcp",
		Addr: nil,
		Err:  &timeoutError{},
	}
}

type timeoutError struct{}

func (e *timeoutError) Error() string   { return "timeout waiting for server to be ready" }
func (e *timeoutError) Timeout() bool   { return true }
func (e *timeoutError) Temporary() bool { return true }

func (env *TestEnv) CreateTestUser(username string, role models.UserRole, facilityId uint, residentId string) (*models.User, error) {
	user := &models.User{
		Username:   username,
		NameFirst:  "Test",
		NameLast:   "User",
		Role:       role,
		Email:      username + "@example.com",
		DocID:      residentId,
		FacilityID: facilityId,
	}

	if err := env.DB.CreateUser(user); err != nil {
		return nil, err
	}

	return user, nil
}

func (env *TestEnv) CreateTestFacility(name string) (*models.Facility, error) {

	facility := &models.Facility{
		Timezone: "America/Chicago",
		Name:     name,
	}

	if err := env.DB.CreateFacility(facility); err != nil {
		return nil, err
	}

	return facility, nil
}

func (env *TestEnv) CreateTestProgram(name string, fundingType models.FundingType, programTypes []models.ProgramType, creditTypes []models.ProgramCreditType, isActive bool, archivedAt *time.Time) (*models.Program, error) {
	program := &models.Program{
		Name:               name,
		Description:        "This is a test program created for integration testing purposes.",
		FundingType:        fundingType,
		ProgramTypes:       programTypes,
		ProgramCreditTypes: creditTypes,
		IsActive:           isActive,
		ArchivedAt:         archivedAt,
	}

	if err := env.DB.CreateProgram(program); err != nil {
		return nil, err
	}
	return program, nil
}

func (env *TestEnv) SetFacilitiesToProgram(programId uint, facilityIds []uint) error {
	if err := env.DB.Where("program_id = ?", programId).Delete(&models.FacilitiesPrograms{}).Error; err != nil {
		return err
	}

	facilityPrograms := src.IterMap(func(id uint) models.FacilitiesPrograms {
		return models.FacilitiesPrograms{
			FacilityID: id,
			ProgramID:  programId,
		}
	}, facilityIds)

	if len(facilityPrograms) > 0 {
		if err := env.DB.Model(&models.FacilitiesPrograms{}).Create(&facilityPrograms).Error; err != nil {
			return err
		}
	}

	return nil
}

func (env *TestEnv) TruncateTable(tableName string) error {
	if err := env.DB.DB.Exec("TRUNCATE TABLE " + tableName + " CASCADE").Error; err != nil {
		return err
	}
	return nil
}

func (env *TestEnv) CleanupDatabase() error {
	tables := []string{
		"users",
		"facilities",
		"programs",
		"program_types",
		"program_credit_types",
		"facilities_programs",
		"program_classes",
	}

	for _, table := range tables {
		if err := env.TruncateTable(table); err != nil {
			log.Printf("Failed to truncate table %s: %v", table, err)
			return err
		}
	}

	return nil
}
