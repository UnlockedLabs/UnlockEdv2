package integration

import (
	"UnlockEdv2/src/models"
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

type ProgramsStatsTestSuite struct {
	suite.Suite
	env *TestEnv
}

func (suite *ProgramsStatsTestSuite) SetupSuite() {
	suite.env = SetupTestEnv(suite.T())
}

func (suite *ProgramsStatsTestSuite) TearDownSuite() {
	suite.env.CleanupTestEnv()
}

func (suite *ProgramsStatsTestSuite) SetupTest() {
	// Clean database before each test
	suite.cleanDatabase()
}

func (suite *ProgramsStatsTestSuite) cleanDatabase() {
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

func (suite *ProgramsStatsTestSuite) createTestFacility(name string) *models.Facility {
	facility := &models.Facility{
		Name: name,
	}
	result := suite.env.DB.Create(facility)
	assert.NoError(suite.T(), result.Error)
	return facility
}

func (suite *ProgramsStatsTestSuite) createTestProgram(name string) *models.Program {
	program := &models.Program{
		Name:     name,
		IsActive: true,
	}
	result := suite.env.DB.Create(program)
	assert.NoError(suite.T(), result.Error)
	return program
}

func (suite *ProgramsStatsTestSuite) createTestUser(facilityID uint, role models.UserRole) *models.User {
	timestamp := time.Now().Format("20060102150405") + fmt.Sprintf("%d", time.Now().Nanosecond())
	user := &models.User{
		NameFirst:  "Test",
		NameLast:   "User",
		Username:   "testuser" + timestamp,
		Email:      "test" + timestamp + "@example.com",
		Role:       role,
		FacilityID: facilityID,
	}
	result := suite.env.DB.Create(user)
	assert.NoError(suite.T(), result.Error)
	return user
}

func (suite *ProgramsStatsTestSuite) createProgramFacilityAssociation(programID, facilityID uint) {
	association := &models.FacilitiesPrograms{
		FacilityID: facilityID,
		ProgramID:  programID,
	}
	result := suite.env.DB.Create(association)
	assert.NoError(suite.T(), result.Error)
}

func (suite *ProgramsStatsTestSuite) createTestClass(programID, facilityID uint, status models.ClassStatus) *models.ProgramClass {
	class := &models.ProgramClass{
		ProgramID:  programID,
		FacilityID: facilityID,
		Status:     status,
		Name:       "Test Class",
	}
	result := suite.env.DB.Create(class)
	assert.NoError(suite.T(), result.Error)
	return class
}

func (suite *ProgramsStatsTestSuite) createTestEnrollment(classID, userID uint, status models.ProgramEnrollmentStatus, enrolledAt, endedAt *time.Time) *models.ProgramClassEnrollment {
	enrollment := &models.ProgramClassEnrollment{
		ClassID:           classID,
		UserID:            userID,
		EnrollmentStatus:  status,
		EnrolledAt:        enrolledAt,
		EnrollmentEndedAt: endedAt,
	}
	result := suite.env.DB.Create(enrollment)
	assert.NoError(suite.T(), result.Error)
	return enrollment
}

func (suite *ProgramsStatsTestSuite) TestGetProgramsFacilitiesStats_EmptyDatabase() {
	ctx := context.Background()
	args := &models.QueryContext{
		Ctx: ctx,
	}

	stats, err := suite.env.DB.GetProgramsFacilitiesStats(args, -1)

	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(0), *stats.TotalPrograms)
	assert.Equal(suite.T(), int64(0), *stats.TotalEnrollments)
	assert.Equal(suite.T(), float64(0), *stats.AvgActiveProgramsPerFacility)
	assert.Equal(suite.T(), float64(0), *stats.AttendanceRate)
	assert.Equal(suite.T(), float64(0), *stats.CompletionRate)
}

func (suite *ProgramsStatsTestSuite) TestGetProgramsFacilitiesStats_BasicScenario() {
	// Setup: Create facilities, programs, and associations
	facility1 := suite.createTestFacility("Facility 1")
	facility2 := suite.createTestFacility("Facility 2")

	program1 := suite.createTestProgram("Program 1")
	program2 := suite.createTestProgram("Program 2")

	// Create facility-program associations
	suite.createProgramFacilityAssociation(program1.ID, facility1.ID)
	suite.createProgramFacilityAssociation(program2.ID, facility1.ID)
	suite.createProgramFacilityAssociation(program1.ID, facility2.ID)

	// Create active classes with enrollments
	class1 := suite.createTestClass(program1.ID, facility1.ID, models.Active)
	class2 := suite.createTestClass(program2.ID, facility1.ID, models.Active)
	class3 := suite.createTestClass(program1.ID, facility2.ID, models.Active)

	// Create users for enrollments
	student1 := suite.createTestUser(facility1.ID, models.Student)
	student2 := suite.createTestUser(facility2.ID, models.Student)

	// Create enrollments
	now := time.Now()
	suite.createTestEnrollment(class1.ID, student1.ID, models.Enrolled, &now, nil)
	suite.createTestEnrollment(class2.ID, student1.ID, models.Enrolled, &now, nil)
	suite.createTestEnrollment(class3.ID, student2.ID, models.Enrolled, &now, nil)

	ctx := context.Background()
	args := &models.QueryContext{
		Ctx: ctx,
	}

	stats, err := suite.env.DB.GetProgramsFacilitiesStats(args, -1)

	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(2), *stats.TotalPrograms)    // 2 active programs total
	assert.Equal(suite.T(), int64(3), *stats.TotalEnrollments) // 3 total enrollments

	// Average programs per facility: 3 program-facility pairs / 2 facilities = 1.5
	assert.Equal(suite.T(), float64(1.5), *stats.AvgActiveProgramsPerFacility)
}

func (suite *ProgramsStatsTestSuite) TestGetProgramsFacilitiesStats_InactivePrograms() {
	// Setup: Create a facility and programs, but make one inactive
	facility := suite.createTestFacility("Test Facility")

	activeProgram := suite.createTestProgram("Active Program")
	inactiveProgram := &models.Program{
		Name:     "Inactive Program",
		IsActive: false, // This should be excluded
	}
	suite.env.DB.Create(inactiveProgram)

	suite.createProgramFacilityAssociation(activeProgram.ID, facility.ID)
	suite.createProgramFacilityAssociation(inactiveProgram.ID, facility.ID)

	// Create classes for both programs
	activeClass := suite.createTestClass(activeProgram.ID, facility.ID, models.Active)
	inactiveClass := suite.createTestClass(inactiveProgram.ID, facility.ID, models.Active)

	student := suite.createTestUser(facility.ID, models.Student)
	now := time.Now()

	// Create enrollments for both
	suite.createTestEnrollment(activeClass.ID, student.ID, models.Enrolled, &now, nil)
	suite.createTestEnrollment(inactiveClass.ID, student.ID, models.Enrolled, &now, nil)

	ctx := context.Background()
	args := &models.QueryContext{
		Ctx: ctx,
	}

	stats, err := suite.env.DB.GetProgramsFacilitiesStats(args, -1)

	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(1), *stats.TotalPrograms)                  // Only active program counted
	assert.Equal(suite.T(), int64(2), *stats.TotalEnrollments)               // Both enrollments counted
	assert.Equal(suite.T(), float64(1), *stats.AvgActiveProgramsPerFacility) // Only active program
}

func (suite *ProgramsStatsTestSuite) TestGetProgramsFacilitiesStats_ArchivedPrograms() {
	// Setup: Create programs, one archived
	facility := suite.createTestFacility("Test Facility")

	activeProgram := suite.createTestProgram("Active Program")

	archivedProgram := &models.Program{
		Name:       "Archived Program",
		IsActive:   true,
		ArchivedAt: &time.Time{}, // Archived programs should be excluded
	}
	suite.env.DB.Create(archivedProgram)

	suite.createProgramFacilityAssociation(activeProgram.ID, facility.ID)
	suite.createProgramFacilityAssociation(archivedProgram.ID, facility.ID)

	ctx := context.Background()
	args := &models.QueryContext{
		Ctx: ctx,
	}

	stats, err := suite.env.DB.GetProgramsFacilitiesStats(args, -1)

	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(1), *stats.TotalPrograms) // Only non-archived program
}

func (suite *ProgramsStatsTestSuite) TestGetProgramsFacilitiesStats_NoActiveClasses() {
	// Setup: Programs exist but no active classes with enrollments
	facility := suite.createTestFacility("Test Facility")
	program := suite.createTestProgram("Test Program")
	suite.createProgramFacilityAssociation(program.ID, facility.ID)

	// Create inactive class
	suite.createTestClass(program.ID, facility.ID, models.Cancelled)

	ctx := context.Background()
	args := &models.QueryContext{
		Ctx: ctx,
	}

	stats, err := suite.env.DB.GetProgramsFacilitiesStats(args, -1)

	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(1), *stats.TotalPrograms)                  // Program exists
	assert.Equal(suite.T(), int64(0), *stats.TotalEnrollments)               // No enrollments
	assert.Equal(suite.T(), float64(0), *stats.AvgActiveProgramsPerFacility) // No qualifying programs
}

func (suite *ProgramsStatsTestSuite) TestGetProgramsFacilitiesStats_TimeFiltering() {
	// Setup: Create enrollments with different completion dates
	facility := suite.createTestFacility("Test Facility")
	program := suite.createTestProgram("Test Program")
	suite.createProgramFacilityAssociation(program.ID, facility.ID)

	class := suite.createTestClass(program.ID, facility.ID, models.Active)
	student := suite.createTestUser(facility.ID, models.Student)

	now := time.Now()
	recentDate := now.AddDate(0, 0, -5) // 5 days ago
	oldDate := now.AddDate(0, 0, -35)   // 35 days ago

	// Create recent completed enrollment
	suite.createTestEnrollment(class.ID, student.ID, models.EnrollmentCompleted, &recentDate, &recentDate)

	// Create old completed enrollment
	student2 := suite.createTestUser(facility.ID, models.Student)
	suite.createTestEnrollment(class.ID, student2.ID, models.EnrollmentCompleted, &oldDate, &oldDate)

	ctx := context.Background()
	args := &models.QueryContext{
		Ctx: ctx,
	}

	// Test with 30-day filter - should only include recent completion
	stats, err := suite.env.DB.GetProgramsFacilitiesStats(args, 30)

	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(1), *stats.TotalPrograms)
	assert.Equal(suite.T(), int64(2), *stats.TotalEnrollments)   // Both enrollments counted for total
	assert.Greater(suite.T(), *stats.CompletionRate, float64(0)) // Should have completion rate based on time filter
}

func (suite *ProgramsStatsTestSuite) TestGetProgramsFacilityStats_FacilitySpecific() {
	// Setup: Create multiple facilities with programs
	facility1 := suite.createTestFacility("Facility 1")
	facility2 := suite.createTestFacility("Facility 2")

	program1 := suite.createTestProgram("Program 1")
	program2 := suite.createTestProgram("Program 2")

	// Associate programs with both facilities
	suite.createProgramFacilityAssociation(program1.ID, facility1.ID)
	suite.createProgramFacilityAssociation(program2.ID, facility1.ID)
	suite.createProgramFacilityAssociation(program1.ID, facility2.ID)

	// Create active classes with enrollments for both facilities
	class1 := suite.createTestClass(program1.ID, facility1.ID, models.Active)
	class2 := suite.createTestClass(program2.ID, facility1.ID, models.Active)
	class3 := suite.createTestClass(program1.ID, facility2.ID, models.Active)

	student1 := suite.createTestUser(facility1.ID, models.Student)
	student2 := suite.createTestUser(facility2.ID, models.Student)

	now := time.Now()
	suite.createTestEnrollment(class1.ID, student1.ID, models.Enrolled, &now, nil)
	suite.createTestEnrollment(class2.ID, student1.ID, models.Enrolled, &now, nil)
	suite.createTestEnrollment(class3.ID, student2.ID, models.Enrolled, &now, nil)

	ctx := context.Background()
	args := &models.QueryContext{
		Ctx:        ctx,
		FacilityID: facility1.ID,
	}

	// Test facility-specific stats for facility1
	stats, err := suite.env.DB.GetProgramsFacilityStats(args, -1)

	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(2), *stats.TotalPrograms)                  // 2 programs for facility1
	assert.Equal(suite.T(), int64(2), *stats.TotalEnrollments)               // 2 enrollments for facility1
	assert.Equal(suite.T(), float64(2), *stats.AvgActiveProgramsPerFacility) // For single facility, this equals program count
}

func TestProgramsStatsTestSuite(t *testing.T) {
	suite.Run(t, new(ProgramsStatsTestSuite))
}
