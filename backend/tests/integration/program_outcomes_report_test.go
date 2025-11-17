package integration

import (
	"UnlockEdv2/src/models"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

type ProgramOutcomesReportTestSuite struct {
	suite.Suite
	env *TestEnv
}

func (suite *ProgramOutcomesReportTestSuite) SetupSuite() {
	suite.env = SetupTestEnv(suite.T())
}

func (suite *ProgramOutcomesReportTestSuite) TearDownSuite() {
	suite.env.CleanupTestEnv()
}

func (suite *ProgramOutcomesReportTestSuite) SetupTest() {
	suite.cleanDatabase()
}

func (suite *ProgramOutcomesReportTestSuite) cleanDatabase() {
	suite.env.DB.Exec("DELETE FROM program_class_event_attendance")
	suite.env.DB.Exec("DELETE FROM program_class_events")
	suite.env.DB.Exec("DELETE FROM program_class_enrollments")
	suite.env.DB.Exec("DELETE FROM program_classes")
	suite.env.DB.Exec("DELETE FROM program_types")
	suite.env.DB.Exec("DELETE FROM facilities_programs")
	suite.env.DB.Exec("DELETE FROM programs")
	suite.env.DB.Exec("DELETE FROM facilities")
	suite.env.DB.Exec("DELETE FROM users WHERE role != 'system_admin'")
}

func (suite *ProgramOutcomesReportTestSuite) TestClassStatusFilter_Active() {
	facility := suite.createFacility("Test Facility")
	program := suite.createProgram("Test Program", facility.ID, models.StateGrants)

	activeClass := suite.createClass("Active Class", program.ID, facility.ID, models.Active)
	pausedClass := suite.createClass("Paused Class", program.ID, facility.ID, models.Paused)

	student1 := suite.createStudent("Student", "One", facility.ID)
	student2 := suite.createStudent("Student", "Two", facility.ID)

	now := time.Now()
	suite.createEnrollment(activeClass.ID, student1.ID, now.AddDate(0, -1, 0), models.Enrolled)
	suite.createEnrollment(pausedClass.ID, student2.ID, now.AddDate(0, -1, 0), models.Enrolled)

	req := &models.ReportGenerateRequest{
		Type:        models.ProgramOutcomesReport,
		StartDate:   now.AddDate(0, -2, 0),
		EndDate:     now,
		ClassStatus: stringPtr("Active"),
	}

	results, err := suite.env.DB.GenerateProgramOutcomesReport(suite.env.Context, req)
	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), results, 1)
	assert.Equal(suite.T(), 1, results[0].TotalEnrollments)
	assert.Equal(suite.T(), 1, results[0].ActiveEnrollments)
}

func (suite *ProgramOutcomesReportTestSuite) TestClassStatusFilter_NotActive() {
	facility := suite.createFacility("Test Facility")
	program := suite.createProgram("Test Program", facility.ID, models.StateGrants)

	activeClass := suite.createClass("Active Class", program.ID, facility.ID, models.Active)
	completedClass := suite.createClass("Completed Class", program.ID, facility.ID, models.Completed)
	cancelledClass := suite.createClass("Cancelled Class", program.ID, facility.ID, models.Cancelled)

	student1 := suite.createStudent("Student", "One", facility.ID)
	student2 := suite.createStudent("Student", "Two", facility.ID)
	student3 := suite.createStudent("Student", "Three", facility.ID)

	now := time.Now()
	suite.createEnrollment(activeClass.ID, student1.ID, now.AddDate(0, -1, 0), models.Enrolled)
	suite.createEnrollment(completedClass.ID, student2.ID, now.AddDate(0, -1, 0), models.Enrolled)
	suite.createEnrollment(cancelledClass.ID, student3.ID, now.AddDate(0, -1, 0), models.Enrolled)

	req := &models.ReportGenerateRequest{
		Type:        models.ProgramOutcomesReport,
		StartDate:   now.AddDate(0, -2, 0),
		EndDate:     now,
		ClassStatus: stringPtr("Not Active"),
	}

	results, err := suite.env.DB.GenerateProgramOutcomesReport(suite.env.Context, req)
	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), results, 1)
	assert.Equal(suite.T(), 2, results[0].TotalEnrollments)
}

func (suite *ProgramOutcomesReportTestSuite) TestClassStatusFilter_All() {
	facility := suite.createFacility("Test Facility")
	program := suite.createProgram("Test Program", facility.ID, models.StateGrants)

	activeClass := suite.createClass("Active Class", program.ID, facility.ID, models.Active)
	pausedClass := suite.createClass("Paused Class", program.ID, facility.ID, models.Paused)

	student1 := suite.createStudent("Student", "One", facility.ID)
	student2 := suite.createStudent("Student", "Two", facility.ID)

	now := time.Now()
	suite.createEnrollment(activeClass.ID, student1.ID, now.AddDate(0, -1, 0), models.Enrolled)
	suite.createEnrollment(pausedClass.ID, student2.ID, now.AddDate(0, -1, 0), models.Enrolled)

	req := &models.ReportGenerateRequest{
		Type:        models.ProgramOutcomesReport,
		StartDate:   now.AddDate(0, -2, 0),
		EndDate:     now,
		ClassStatus: stringPtr("All"),
	}

	results, err := suite.env.DB.GenerateProgramOutcomesReport(suite.env.Context, req)
	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), results, 1)
	assert.Equal(suite.T(), 2, results[0].TotalEnrollments)
}

func (suite *ProgramOutcomesReportTestSuite) TestClassStatusFilter_DefaultsToActive() {
	facility := suite.createFacility("Test Facility")
	program := suite.createProgram("Test Program", facility.ID, models.StateGrants)

	activeClass := suite.createClass("Active Class", program.ID, facility.ID, models.Active)
	pausedClass := suite.createClass("Paused Class", program.ID, facility.ID, models.Paused)

	student1 := suite.createStudent("Student", "One", facility.ID)
	student2 := suite.createStudent("Student", "Two", facility.ID)

	now := time.Now()
	suite.createEnrollment(activeClass.ID, student1.ID, now.AddDate(0, -1, 0), models.Enrolled)
	suite.createEnrollment(pausedClass.ID, student2.ID, now.AddDate(0, -1, 0), models.Enrolled)

	req := &models.ReportGenerateRequest{
		Type:        models.ProgramOutcomesReport,
		StartDate:   now.AddDate(0, -2, 0),
		EndDate:     now,
		ClassStatus: nil,
	}

	results, err := suite.env.DB.GenerateProgramOutcomesReport(suite.env.Context, req)
	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), results, 1)
	assert.Equal(suite.T(), 1, results[0].TotalEnrollments)
}

func (suite *ProgramOutcomesReportTestSuite) TestMultipleProgramTypes_NoDuplicateRows() {
	facility := suite.createFacility("Test Facility")
	program := suite.createProgram("Test Program", facility.ID, models.StateGrants)

	suite.addProgramType(program.ID, models.Educational)
	suite.addProgramType(program.ID, models.Vocational)

	activeClass := suite.createClass("Active Class", program.ID, facility.ID, models.Active)

	student1 := suite.createStudent("Student", "One", facility.ID)
	student2 := suite.createStudent("Student", "Two", facility.ID)

	now := time.Now()
	suite.createEnrollment(activeClass.ID, student1.ID, now.AddDate(0, -1, 0), models.Enrolled)
	suite.createEnrollment(activeClass.ID, student2.ID, now.AddDate(0, -1, 0), models.Enrolled)

	req := &models.ReportGenerateRequest{
		Type:      models.ProgramOutcomesReport,
		StartDate: now.AddDate(0, -2, 0),
		EndDate:   now,
	}

	results, err := suite.env.DB.GenerateProgramOutcomesReport(suite.env.Context, req)
	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), results, 1, "Should return single row even with multiple program types")
	assert.Equal(suite.T(), 2, results[0].TotalEnrollments)
	assert.Contains(suite.T(), results[0].ProgramType, "Educational")
	assert.Contains(suite.T(), results[0].ProgramType, "Vocational")
}

func (suite *ProgramOutcomesReportTestSuite) TestEnrollmentDateFiltering() {
	facility := suite.createFacility("Test Facility")
	program := suite.createProgram("Test Program", facility.ID, models.StateGrants)
	activeClass := suite.createClass("Active Class", program.ID, facility.ID, models.Active)

	student1 := suite.createStudent("Student", "One", facility.ID)
	student2 := suite.createStudent("Student", "Two", facility.ID)
	student3 := suite.createStudent("Student", "Three", facility.ID)

	now := time.Now()
	reportStart := now.AddDate(0, -1, 0)
	reportEnd := now

	suite.createEnrollment(activeClass.ID, student1.ID, now.AddDate(0, -2, 0), models.Enrolled)
	suite.createEnrollment(activeClass.ID, student2.ID, now.AddDate(0, -1, 5), models.Enrolled)
	suite.createEnrollment(activeClass.ID, student3.ID, now.AddDate(0, 1, 0), models.Enrolled)

	req := &models.ReportGenerateRequest{
		Type:      models.ProgramOutcomesReport,
		StartDate: reportStart,
		EndDate:   reportEnd,
	}

	results, err := suite.env.DB.GenerateProgramOutcomesReport(suite.env.Context, req)
	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), results, 1)
	assert.Equal(suite.T(), 2, results[0].TotalEnrollments, "Should include enrollments before and within range, exclude future")
}

func (suite *ProgramOutcomesReportTestSuite) TestEnrollmentStatusCounts() {
	facility := suite.createFacility("Test Facility")
	program := suite.createProgram("Test Program", facility.ID, models.StateGrants)
	activeClass := suite.createClass("Active Class", program.ID, facility.ID, models.Active)

	students := make([]*models.User, 10)
	for i := 0; i < 10; i++ {
		students[i] = suite.createStudent("Student", fmt.Sprintf("%d", i), facility.ID)
	}

	now := time.Now()

	suite.createEnrollment(activeClass.ID, students[0].ID, now.AddDate(0, -1, 0), models.Enrolled)
	suite.createEnrollment(activeClass.ID, students[1].ID, now.AddDate(0, -1, 0), models.Enrolled)
	suite.createEnrollment(activeClass.ID, students[2].ID, now.AddDate(0, -1, 0), models.Enrolled)
	suite.createEnrollment(activeClass.ID, students[3].ID, now.AddDate(0, -1, 0), models.EnrollmentCompleted)
	suite.createEnrollment(activeClass.ID, students[4].ID, now.AddDate(0, -1, 0), models.EnrollmentCompleted)
	suite.createEnrollment(activeClass.ID, students[5].ID, now.AddDate(0, -1, 0), models.EnrollmentIncompleteDropped)
	suite.createEnrollment(activeClass.ID, students[6].ID, now.AddDate(0, -1, 0), models.EnrollmentIncompleteDropped)
	suite.createEnrollment(activeClass.ID, students[7].ID, now.AddDate(0, -1, 0), models.EnrollmentIncompleteDropped)

	req := &models.ReportGenerateRequest{
		Type:      models.ProgramOutcomesReport,
		StartDate: now.AddDate(0, -2, 0),
		EndDate:   now,
	}

	results, err := suite.env.DB.GenerateProgramOutcomesReport(suite.env.Context, req)
	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), results, 1)
	assert.Equal(suite.T(), 8, results[0].TotalEnrollments, "Total should include all statuses")
	assert.Equal(suite.T(), 3, results[0].ActiveEnrollments, "Active should only include Enrolled status")
	assert.Equal(suite.T(), 2, results[0].CompletedEnrollments)
	assert.Equal(suite.T(), 3, results[0].DroppedEnrollments)
}

func (suite *ProgramOutcomesReportTestSuite) TestAttendanceDoesNotAffectEnrollmentCounts() {
	facility := suite.createFacility("Test Facility")
	program := suite.createProgram("Test Program", facility.ID, models.StateGrants)
	activeClass := suite.createClass("Active Class", program.ID, facility.ID, models.Active)

	student1 := suite.createStudent("Student", "One", facility.ID)
	student2 := suite.createStudent("Student", "Two", facility.ID)

	now := time.Now()
	suite.createEnrollment(activeClass.ID, student1.ID, now.AddDate(0, -1, 0), models.Enrolled)
	suite.createEnrollment(activeClass.ID, student2.ID, now.AddDate(0, -1, 0), models.Enrolled)

	event1 := suite.createEvent(activeClass.ID, now.AddDate(0, 0, -5))
	event2 := suite.createEvent(activeClass.ID, now.AddDate(0, 0, -4))
	event3 := suite.createEvent(activeClass.ID, now.AddDate(0, 0, -3))

	suite.createAttendance(event1.ID, student1.ID, models.Present)
	suite.createAttendance(event2.ID, student1.ID, models.Present)
	suite.createAttendance(event3.ID, student1.ID, models.Present)
	suite.createAttendance(event1.ID, student2.ID, models.Absent_Unexcused)

	req := &models.ReportGenerateRequest{
		Type:      models.ProgramOutcomesReport,
		StartDate: now.AddDate(0, -2, 0),
		EndDate:   now,
	}

	results, err := suite.env.DB.GenerateProgramOutcomesReport(suite.env.Context, req)
	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), results, 1)
	assert.Equal(suite.T(), 2, results[0].TotalEnrollments, "Enrollment count should not be affected by attendance records")
	assert.Equal(suite.T(), 2, results[0].ActiveEnrollments)
}

func (suite *ProgramOutcomesReportTestSuite) TestMultipleClassesInSameProgram() {
	facility := suite.createFacility("Test Facility")
	program := suite.createProgram("Test Program", facility.ID, models.StateGrants)

	class1 := suite.createClass("Class 1", program.ID, facility.ID, models.Active)
	class2 := suite.createClass("Class 2", program.ID, facility.ID, models.Active)

	students := make([]*models.User, 9)
	for i := 0; i < 9; i++ {
		students[i] = suite.createStudent("Student", fmt.Sprintf("%d", i), facility.ID)
	}

	now := time.Now()

	for i := 0; i < 5; i++ {
		suite.createEnrollment(class1.ID, students[i].ID, now.AddDate(0, -1, 0), models.Enrolled)
	}
	for i := 5; i < 9; i++ {
		suite.createEnrollment(class2.ID, students[i].ID, now.AddDate(0, -1, 0), models.Enrolled)
	}

	req := &models.ReportGenerateRequest{
		Type:      models.ProgramOutcomesReport,
		StartDate: now.AddDate(0, -2, 0),
		EndDate:   now,
	}

	results, err := suite.env.DB.GenerateProgramOutcomesReport(suite.env.Context, req)
	assert.NoError(suite.T(), err)
	assert.Len(suite.T(), results, 1)
	assert.Equal(suite.T(), 9, results[0].TotalEnrollments)
}

func (suite *ProgramOutcomesReportTestSuite) createFacility(name string) *models.Facility {
	facility := &models.Facility{Name: name}
	suite.env.DB.Create(facility)
	return facility
}

func (suite *ProgramOutcomesReportTestSuite) createProgram(name string, facilityID uint, fundingType models.FundingType) *models.Program {
	program := &models.Program{
		Name:        name,
		IsActive:    true,
		FundingType: fundingType,
	}
	suite.env.DB.Create(program)

	association := &models.FacilitiesPrograms{
		FacilityID: facilityID,
		ProgramID:  program.ID,
	}
	suite.env.DB.Create(association)

	return program
}

func (suite *ProgramOutcomesReportTestSuite) addProgramType(programID uint, progType models.ProgType) {
	pt := &models.ProgramType{
		ProgramID:   programID,
		ProgramType: progType,
	}
	suite.env.DB.Create(pt)
}

func (suite *ProgramOutcomesReportTestSuite) createClass(name string, programID, facilityID uint, status models.ClassStatus) *models.ProgramClass {
	class := &models.ProgramClass{
		Name:       name,
		ProgramID:  programID,
		FacilityID: facilityID,
		Status:     status,
	}
	suite.env.DB.Create(class)
	return class
}

func (suite *ProgramOutcomesReportTestSuite) createStudent(firstName, lastName string, facilityID uint) *models.User {
	timestamp := fmt.Sprintf("%d", time.Now().UnixNano())
	student := &models.User{
		NameFirst:  firstName,
		NameLast:   lastName,
		Username:   firstName + lastName + timestamp,
		Email:      firstName + lastName + timestamp + "@test.com",
		Role:       models.Student,
		FacilityID: facilityID,
	}
	suite.env.DB.Create(student)
	return student
}

func (suite *ProgramOutcomesReportTestSuite) createEnrollment(classID, userID uint, enrolledAt time.Time, status models.ProgramEnrollmentStatus) *models.ProgramClassEnrollment {
	enrollment := &models.ProgramClassEnrollment{
		ClassID:          classID,
		UserID:           userID,
		EnrolledAt:       &enrolledAt,
		EnrollmentStatus: status,
	}
	suite.env.DB.Create(enrollment)
	return enrollment
}

func (suite *ProgramOutcomesReportTestSuite) createEvent(classID uint, eventDate time.Time) *models.ProgramClassEvent {
	rrule := fmt.Sprintf("DTSTART:%s\nRRULE:FREQ=DAILY;COUNT=1", eventDate.Format("20060102T090000Z"))
	event := &models.ProgramClassEvent{
		ClassID:        classID,
		Duration:       "2h",
		RecurrenceRule: rrule,
		Room:           "Test Room",
	}
	suite.env.DB.Create(event)
	return event
}

func (suite *ProgramOutcomesReportTestSuite) createAttendance(eventID, userID uint, status models.Attendance) {
	attendance := &models.ProgramClassEventAttendance{
		EventID:          eventID,
		UserID:           userID,
		AttendanceStatus: status,
	}
	suite.env.DB.Create(attendance)
}

func stringPtr(s string) *string {
	return &s
}

func TestProgramOutcomesReportTestSuite(t *testing.T) {
	suite.Run(t, new(ProgramOutcomesReportTestSuite))
}
