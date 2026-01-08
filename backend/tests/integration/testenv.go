package integration

import (
	"UnlockEdv2/src"
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/handlers"
	"UnlockEdv2/src/models"
	"context"
	"fmt"
	"log"
	"net"
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

	ts := httptest.NewServer(server.Handler())

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

func (env *TestEnv) CreateTestClass(program *models.Program, facility *models.Facility, status models.ClassStatus) (*models.ProgramClass, error) {
	endDt := time.Now().Add(time.Hour * 24)
	creditHours := int64(2)

	class := &models.ProgramClass{
		ProgramID:      program.ID,
		FacilityID:     facility.ID,
		Capacity:       10,
		Name:           "Test Class",
		InstructorName: "Test Instructor",
		Description:    "This is a test class created for integration testing purposes.",
		StartDt:        time.Now(),
		EndDt:          &endDt,
		Status:         status,
		CreditHours:    &creditHours,
	}

	if err := env.DB.Create(class).Error; err != nil {
		return nil, err
	}

	return class, nil
}

func (env *TestEnv) CreateTestEnrollment(classID, userID uint, status models.ProgramEnrollmentStatus) (*models.ProgramClassEnrollment, error) {
	enrollment := &models.ProgramClassEnrollment{
		ClassID:          classID,
		UserID:           userID,
		EnrollmentStatus: status,
	}

	if err := env.DB.Create(enrollment).Error; err != nil {
		return nil, err
	}

	return enrollment, nil
}

func (env *TestEnv) GetEnrollmentTimestamps(enrollmentID uint) (enrolledAt, endedAt *time.Time, err error) {
	var enrollment models.ProgramClassEnrollment
	if err := env.DB.First(&enrollment, "id = ?", enrollmentID).Error; err != nil {
		return nil, nil, err
	}
	return enrollment.EnrolledAt, enrollment.EnrollmentEndedAt, nil
}

func (env *TestEnv) CreateTestEvent(classID uint, rrule string) (*models.ProgramClassEvent, error) {
	if rrule == "" {
		startDate := time.Now().AddDate(0, 0, -2) // 2 days ago
		rrule = fmt.Sprintf("DTSTART:%s\nRRULE:FREQ=DAILY;COUNT=10", startDate.Format("20060102T090000Z"))
	}

	event := &models.ProgramClassEvent{
		ClassID:        classID,
		Duration:       "2h",
		RecurrenceRule: rrule,
		Room:           "Test Room",
	}

	if err := env.DB.Create(event).Error; err != nil {
		return nil, err
	}

	return event, nil
}

func (env *TestEnv) GetEventRecurrenceRule(eventID uint) (string, error) {
	var event models.ProgramClassEvent
	if err := env.DB.First(&event, "id = ?", eventID).Error; err != nil {
		return "", err
	}
	return event.RecurrenceRule, nil
}

func (env *TestEnv) CreateTestEventWithRRule(classID uint, customRRule string) (*models.ProgramClassEvent, error) {
	event := &models.ProgramClassEvent{
		ClassID:        classID,
		Duration:       "2h",
		RecurrenceRule: customRRule,
		Room:           "Test Room",
	}
	if err := env.DB.Create(event).Error; err != nil {
		return nil, err
	}
	return event, nil
}

func (env *TestEnv) CreateTestEventOverride(eventID uint, date string, isCancelled bool, reason string) (*models.ProgramClassEventOverride, error) {
	parsedDate, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, err
	}

	rrule := fmt.Sprintf("DTSTART:%s\nRRULE:FREQ=DAILY;COUNT=1", parsedDate.Format("20060102T090000Z"))

	override := &models.ProgramClassEventOverride{
		EventID:       eventID,
		Duration:      "2h",
		OverrideRrule: rrule,
		IsCancelled:   isCancelled,
		Reason:        reason,
		Room:          "Test Room",
	}

	if err := env.DB.Create(override).Error; err != nil {
		return nil, err
	}

	return override, nil
}

func (env *TestEnv) CreateTestAttendance(eventID, userID uint, date time.Time, status models.Attendance, reason string) (*models.ProgramClassEventAttendance, error) {
	attendance := &models.ProgramClassEventAttendance{
		EventID:          eventID,
		UserID:           userID,
		Date:             date.Format("2006-01-02"),
		AttendanceStatus: status,
		Note:             reason,
	}

	if err := env.DB.Create(attendance).Error; err != nil {
		return nil, err
	}

	return attendance, nil
}

func (env *TestEnv) SetClassCreditHours(classID uint, creditHours int64) error {
	return env.DB.Model(&models.ProgramClass{}).Where("id = ?", classID).Update("credit_hours", creditHours).Error
}

func (env *TestEnv) CreateTestEnrollmentWithDates(classID, userID uint, status models.ProgramEnrollmentStatus, enrolledAt time.Time, endedAt *time.Time) (*models.ProgramClassEnrollment, error) {
	enrollment := &models.ProgramClassEnrollment{
		ClassID:           classID,
		UserID:            userID,
		EnrollmentStatus:  status,
		EnrolledAt:        &enrolledAt,
		EnrollmentEndedAt: endedAt,
	}

	if err := env.DB.Create(enrollment).Error; err != nil {
		return nil, err
	}

	return enrollment, nil
}
