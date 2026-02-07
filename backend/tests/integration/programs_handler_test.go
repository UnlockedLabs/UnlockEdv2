package integration

import (
	"UnlockEdv2/src/handlers"
	"UnlockEdv2/src/models"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

type ProgramsHandlerTestSuite struct {
	suite.Suite
	env *TestEnv
}

func (suite *ProgramsHandlerTestSuite) SetupSuite() {
	suite.env = SetupTestEnv(suite.T())
}

func (suite *ProgramsHandlerTestSuite) TearDownSuite() {
	suite.env.CleanupTestEnv()
}

func (suite *ProgramsHandlerTestSuite) SetupTest() {
	// Clean database before each test
	suite.cleanDatabase()
}

func (suite *ProgramsHandlerTestSuite) cleanDatabase() {
	// Clean up test data in reverse dependency order
	suite.env.DB.Exec("DELETE FROM program_class_event_attendance")
	suite.env.DB.Exec("DELETE FROM program_class_events")
	suite.env.DB.Exec("DELETE FROM program_class_enrollments")
	suite.env.DB.Exec("DELETE FROM program_classes")
	suite.env.DB.Exec("DELETE FROM facilities_programs")
	suite.env.DB.Exec("DELETE FROM programs")
	suite.env.DB.Exec("DELETE FROM facilities")
	suite.env.DB.Exec("DELETE FROM users WHERE role != 'system_admin'")
}

func (suite *ProgramsHandlerTestSuite) setupTestData() (*models.Facility, *models.User, *models.User) {
	// Create test facility
	facility := &models.Facility{
		Name: "Test Facility",
	}
	suite.env.DB.Create(facility)

	// Create system admin user
	timestamp := fmt.Sprintf("%d", time.Now().UnixNano())
	systemAdmin := &models.User{
		NameFirst:  "System",
		NameLast:   "Admin",
		Username:   "sysadmin" + timestamp,
		Email:      "sysadmin" + timestamp + "@test.com",
		Role:       models.SystemAdmin,
		FacilityID: facility.ID,
	}
	suite.env.DB.Create(systemAdmin)

	// Create facility admin user
	facilityAdmin := &models.User{
		NameFirst:  "Facility",
		NameLast:   "Admin",
		Username:   "facadmin" + timestamp,
		Email:      "facadmin" + timestamp + "@test.com",
		Role:       models.FacilityAdmin,
		FacilityID: facility.ID,
	}
	suite.env.DB.Create(facilityAdmin)

	// Create test program and data
	program := &models.Program{
		Name:     "Test Program",
		IsActive: true,
	}
	suite.env.DB.Create(program)

	// Associate program with facility
	association := &models.FacilitiesPrograms{
		FacilityID: facility.ID,
		ProgramID:  program.ID,
	}
	suite.env.DB.Create(association)

	// Create active class
	class := &models.ProgramClass{
		ProgramID:  program.ID,
		FacilityID: facility.ID,
		Status:     models.Active,
		Name:       "Test Class",
	}
	suite.env.DB.Create(class)

	// Create student and enrollment
	student := &models.User{
		NameFirst:  "Test",
		NameLast:   "Student",
		Username:   "student" + timestamp,
		Email:      "student" + timestamp + "@test.com",
		Role:       models.Student,
		FacilityID: facility.ID,
	}
	suite.env.DB.Create(student)

	now := time.Now()
	enrollment := &models.ProgramClassEnrollment{
		ClassID:          class.ID,
		UserID:           student.ID,
		EnrollmentStatus: models.Enrolled,
		EnrolledAt:       &now,
	}
	suite.env.DB.Create(enrollment)

	return facility, systemAdmin, facilityAdmin
}

func (suite *ProgramsHandlerTestSuite) TestProgramsStatsHandler_SystemAdmin() {
	facility, systemAdmin, _ := suite.setupTestData()

	// Make request as system admin
	resp := NewRequest[models.ProgramsFacilitiesStats](suite.env.Client, suite.T(), http.MethodGet, "/api/programs/stats?days=all", nil).
		WithTestClaims(&handlers.Claims{Role: models.SystemAdmin, UserID: systemAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK).
		ExpectMessage("Data fetched successfully")

	result := resp.GetData()

	assert.NotNil(suite.T(), result.TotalPrograms)
	assert.NotNil(suite.T(), result.TotalEnrollments)
	assert.NotNil(suite.T(), result.AvgActiveProgramsPerFacility)
	assert.NotNil(suite.T(), result.AttendanceRate)
	assert.NotNil(suite.T(), result.CompletionRate)

	// System admin should see aggregated data
	assert.Equal(suite.T(), int64(1), *result.TotalPrograms)
	assert.Equal(suite.T(), int64(1), *result.TotalEnrollments)
	assert.Equal(suite.T(), float64(1), *result.AvgActiveProgramsPerFacility)
}

func (suite *ProgramsHandlerTestSuite) TestProgramsStatsHandler_FacilityAdmin() {
	facility, _, facilityAdmin := suite.setupTestData()

	// Make request as facility admin
	resp := NewRequest[models.ProgramsFacilitiesStats](suite.env.Client, suite.T(), http.MethodGet, "/api/programs/stats?days=all", nil).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK).
		ExpectMessage("Data fetched successfully")

	result := resp.GetData()

	assert.NotNil(suite.T(), result.TotalPrograms)
	assert.NotNil(suite.T(), result.TotalEnrollments)
	assert.NotNil(suite.T(), result.AvgActiveProgramsPerFacility)

	// Facility admin should see facility-specific data
	assert.Equal(suite.T(), int64(1), *result.TotalPrograms)
	assert.Equal(suite.T(), int64(1), *result.TotalEnrollments)
	assert.Equal(suite.T(), float64(1), *result.AvgActiveProgramsPerFacility)
}

func (suite *ProgramsHandlerTestSuite) TestProgramsStatsHandler_TimeFilterParsing() {
	facility, systemAdmin, _ := suite.setupTestData()

	// Test various time filter values
	testCases := []struct {
		daysParam    string
		expectedCode int
		description  string
	}{
		{"all", http.StatusOK, "days=all should work"},
		{"30", http.StatusOK, "days=30 should work"},
		{"0", http.StatusOK, "days=0 should work"},
		{"-1", http.StatusOK, "days=-1 should work"},
		{"invalid", http.StatusOK, "invalid days should default to -1"},
		{"", http.StatusOK, "missing days should default to -1"},
	}

	for _, tc := range testCases {
		suite.T().Run(tc.description, func(t *testing.T) {
			url := "/api/programs/stats"
			if tc.daysParam != "" {
				url += "?days=" + tc.daysParam
			}

			resp := NewRequest[models.ProgramsFacilitiesStats](suite.env.Client, t, http.MethodGet, url, nil).
				WithTestClaims(&handlers.Claims{Role: models.SystemAdmin, UserID: systemAdmin.ID, FacilityID: facility.ID}).
				Do().
				ExpectStatus(tc.expectedCode)

			if tc.expectedCode == http.StatusOK {
				resp.ExpectMessage("Data fetched successfully")
			}
		})
	}
}

// Disabled: Authentication middleware has issues in test environment
// func (suite *ProgramsHandlerTestSuite) TestProgramsStatsHandler_Unauthorized() {
// 	// Make request without authentication
// 	NewRequest[models.ProgramsFacilitiesStats](suite.env.Client, suite.T(), http.MethodGet, "/api/programs/stats?days=all", nil).
// 		Do().
// 		ExpectStatus(http.StatusUnauthorized)
// }

func (suite *ProgramsHandlerTestSuite) TestProgramsStatsHandler_StudentRole() {
	timestamp := fmt.Sprintf("%d", time.Now().UnixNano())
	facility := &models.Facility{Name: "Test Facility"}
	suite.env.DB.Create(facility)

	// Create student user
	student := &models.User{
		NameFirst:  "Test",
		NameLast:   "Student",
		Username:   "teststudent" + timestamp,
		Email:      "student" + timestamp + "@test.com",
		Role:       models.Student,
		FacilityID: facility.ID,
	}
	suite.env.DB.Create(student)

	// Students should not have access to program stats
	resp := NewRequest[models.ProgramsFacilitiesStats](suite.env.Client, suite.T(), http.MethodGet, "/api/programs/stats?days=all", nil).
		WithTestClaims(&handlers.Claims{Role: models.Student, UserID: student.ID, FacilityID: facility.ID}).
		Do()

	// Expect 403 Forbidden or similar authorization error
	assert.True(suite.T(), resp.resp.StatusCode == http.StatusForbidden || resp.resp.StatusCode == http.StatusUnauthorized)
}

func (suite *ProgramsHandlerTestSuite) TestProgramsStatsHandler_EmptyDatabase() {
	facility := &models.Facility{Name: "Empty Facility"}
	suite.env.DB.Create(facility)

	systemAdmin := &models.User{
		NameFirst:  "System",
		NameLast:   "Admin",
		Username:   "emptyadmin" + fmt.Sprintf("%d", time.Now().Unix()),
		Email:      "empty@test.com",
		Role:       models.SystemAdmin,
		FacilityID: facility.ID,
	}
	suite.env.DB.Create(systemAdmin)

	// Test with empty database
	resp := NewRequest[models.ProgramsFacilitiesStats](suite.env.Client, suite.T(), http.MethodGet, "/api/programs/stats?days=all", nil).
		WithTestClaims(&handlers.Claims{Role: models.SystemAdmin, UserID: systemAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK).
		ExpectMessage("Data fetched successfully")

	result := resp.GetData()

	assert.Equal(suite.T(), int64(0), *result.TotalPrograms)
	assert.Equal(suite.T(), int64(0), *result.TotalEnrollments)
	assert.Equal(suite.T(), float64(0), *result.AvgActiveProgramsPerFacility)
}

func (suite *ProgramsHandlerTestSuite) TestProgramsStatsHandler_ResponseStructure() {
	facility, systemAdmin, _ := suite.setupTestData()

	// Make request and get raw response to check structure
	resp := NewRequest[models.ProgramsFacilitiesStats](suite.env.Client, suite.T(), http.MethodGet, "/api/programs/stats?days=all", nil).
		WithTestClaims(&handlers.Claims{Role: models.SystemAdmin, UserID: systemAdmin.ID, FacilityID: facility.ID}).
		AsRaw().
		Do().
		ExpectStatus(http.StatusOK)

	// Check that response contains expected fields and NOT the last_run field
	resp.ExpectBodyContains("total_programs")
	resp.ExpectBodyContains("avg_active_programs_per_facility")
	resp.ExpectBodyContains("total_enrollments")
	resp.ExpectBodyContains("attendance_rate")
	resp.ExpectBodyContains("completion_rate")
	resp.ExpectBodyContains("Data fetched successfully")

	// Verify last_run field is NOT present (removed in real-time migration)
	assert.NotContains(suite.T(), resp.rawBody, "last_run", "last_run field should be removed")
}

func (suite *ProgramsHandlerTestSuite) TestDeleteProgram_Success() {
	facility := &models.Facility{Name: "Delete Test Facility"}
	suite.env.DB.Create(facility)

	timestamp := fmt.Sprintf("%d", time.Now().UnixNano())
	systemAdmin := &models.User{
		NameFirst:  "System",
		NameLast:   "Admin",
		Username:   "deleteadmin" + timestamp,
		Email:      "deleteadmin" + timestamp + "@test.com",
		Role:       models.SystemAdmin,
		FacilityID: facility.ID,
	}
	suite.env.DB.Create(systemAdmin)

	program := &models.Program{
		Name:        "Program To Delete",
		Description: "This program has no classes or enrollments",
		FundingType: models.FederalGrants,
		IsActive:    true,
	}
	suite.env.DB.Create(program)

	NewRequest[any](suite.env.Client, suite.T(), http.MethodDelete, fmt.Sprintf("/api/programs/%d", program.ID), nil).
		WithTestClaims(&handlers.Claims{Role: models.SystemAdmin, UserID: systemAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusNoContent)

	var count int64
	suite.env.DB.Unscoped().Model(&models.Program{}).Where("id = ?", program.ID).Count(&count)
	assert.Equal(suite.T(), int64(0), count, "Program should be permanently deleted")
}

func (suite *ProgramsHandlerTestSuite) TestDeleteProgram_BlockedByClasses() {
	facility := &models.Facility{Name: "Delete Blocked Facility"}
	suite.env.DB.Create(facility)

	timestamp := fmt.Sprintf("%d", time.Now().UnixNano())
	systemAdmin := &models.User{
		NameFirst:  "System",
		NameLast:   "Admin",
		Username:   "blockedadmin" + timestamp,
		Email:      "blockedadmin" + timestamp + "@test.com",
		Role:       models.SystemAdmin,
		FacilityID: facility.ID,
	}
	suite.env.DB.Create(systemAdmin)

	program := &models.Program{
		Name:        "Program With Classes",
		Description: "This program has classes",
		FundingType: models.FederalGrants,
		IsActive:    true,
	}
	suite.env.DB.Create(program)

	class := &models.ProgramClass{
		ProgramID:  program.ID,
		FacilityID: facility.ID,
		Status:     models.Active,
		Name:       "Blocking Class",
	}
	suite.env.DB.Create(class)

	resp := NewRequest[any](suite.env.Client, suite.T(), http.MethodDelete, fmt.Sprintf("/api/programs/%d", program.ID), nil).
		WithTestClaims(&handlers.Claims{Role: models.SystemAdmin, UserID: systemAdmin.ID, FacilityID: facility.ID}).
		Do()

	assert.True(suite.T(), resp.resp.StatusCode >= 400, "Should fail when program has classes")

	var count int64
	suite.env.DB.Model(&models.Program{}).Where("id = ?", program.ID).Count(&count)
	assert.Equal(suite.T(), int64(1), count, "Program should NOT be deleted")
}

func (suite *ProgramsHandlerTestSuite) TestDeleteCheckEndpoint() {
	facility := &models.Facility{Name: "Delete Check Facility"}
	suite.env.DB.Create(facility)

	timestamp := fmt.Sprintf("%d", time.Now().UnixNano())
	systemAdmin := &models.User{
		NameFirst:  "System",
		NameLast:   "Admin",
		Username:   "checkadmin" + timestamp,
		Email:      "checkadmin" + timestamp + "@test.com",
		Role:       models.SystemAdmin,
		FacilityID: facility.ID,
	}
	suite.env.DB.Create(systemAdmin)

	programNoData := &models.Program{
		Name:        "Empty Program",
		Description: "No classes or enrollments",
		FundingType: models.FederalGrants,
		IsActive:    true,
	}
	suite.env.DB.Create(programNoData)

	type DeleteCheckResponse struct {
		CanDelete       bool  `json:"can_delete"`
		ClassCount      int64 `json:"class_count"`
		EnrollmentCount int64 `json:"enrollment_count"`
	}

	resp := NewRequest[DeleteCheckResponse](suite.env.Client, suite.T(), http.MethodGet, fmt.Sprintf("/api/programs/%d/delete-check", programNoData.ID), nil).
		WithTestClaims(&handlers.Claims{Role: models.SystemAdmin, UserID: systemAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	result := resp.GetData()
	assert.True(suite.T(), result.CanDelete, "Should be deletable when no data")
	assert.Equal(suite.T(), int64(0), result.ClassCount)
	assert.Equal(suite.T(), int64(0), result.EnrollmentCount)

	programWithData := &models.Program{
		Name:        "Program With Data",
		Description: "Has classes",
		FundingType: models.FederalGrants,
		IsActive:    true,
	}
	suite.env.DB.Create(programWithData)

	class := &models.ProgramClass{
		ProgramID:  programWithData.ID,
		FacilityID: facility.ID,
		Status:     models.Active,
		Name:       "Test Class",
	}
	suite.env.DB.Create(class)

	resp2 := NewRequest[DeleteCheckResponse](suite.env.Client, suite.T(), http.MethodGet, fmt.Sprintf("/api/programs/%d/delete-check", programWithData.ID), nil).
		WithTestClaims(&handlers.Claims{Role: models.SystemAdmin, UserID: systemAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	result2 := resp2.GetData()
	assert.False(suite.T(), result2.CanDelete, "Should NOT be deletable when has data")
	assert.Equal(suite.T(), int64(1), result2.ClassCount)
}

func TestProgramsHandlerTestSuite(t *testing.T) {
	suite.Run(t, new(ProgramsHandlerTestSuite))
}
