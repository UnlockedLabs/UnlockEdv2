package integration

import (
	"UnlockEdv2/src/models"
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProgramOutcomesReport_CreditHoursAggregation(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility := createTestFacility(t, env, "Test Facility")
	program := createTestProgram(t, env, "Math Program", facility.ID)

	class1 := createTestClass(t, env, program, facility, "Math 101")
	err := env.SetClassCreditHours(class1.ID, 3)
	require.NoError(t, err)

	class2 := createTestClass(t, env, program, facility, "Math 102")
	err = env.SetClassCreditHours(class2.ID, 3)
	require.NoError(t, err)

	class3 := createTestClass(t, env, program, facility, "Math 103")
	err = env.SetClassCreditHours(class3.ID, 3)
	require.NoError(t, err)

	user := createTestUser(t, env, "student", facility.ID)
	createTestEnrollment(t, env, class1.ID, user.ID, models.Enrolled)

	req := &models.ReportGenerateRequest{
		Type:      models.ProgramOutcomesReport,
		StartDate: time.Now().AddDate(0, -1, 0),
		EndDate:   time.Now(),
	}

	rows, err := env.DB.GenerateProgramOutcomesReport(context.Background(), req)

	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, float64(9), rows[0].TotalCreditHours, "Credit hours should sum to 9 (3+3+3), not 3 from DISTINCT bug")
}

func TestProgramOutcomesReport_CreditHoursNoDuplication(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility := createTestFacility(t, env, "Test Facility")
	program := createTestProgram(t, env, "English Program", facility.ID)

	class := createTestClass(t, env, program, facility, "English 101")
	err := env.SetClassCreditHours(class.ID, 3)
	require.NoError(t, err)

	user1 := createTestUser(t, env, "student1", facility.ID)
	user2 := createTestUser(t, env, "student2", facility.ID)
	user3 := createTestUser(t, env, "student3", facility.ID)

	createTestEnrollment(t, env, class.ID, user1.ID, models.Enrolled)
	createTestEnrollment(t, env, class.ID, user2.ID, models.Enrolled)
	createTestEnrollment(t, env, class.ID, user3.ID, models.EnrollmentCompleted)

	req := &models.ReportGenerateRequest{
		Type:      models.ProgramOutcomesReport,
		StartDate: time.Now().AddDate(0, -1, 0),
		EndDate:   time.Now(),
	}

	rows, err := env.DB.GenerateProgramOutcomesReport(context.Background(), req)

	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, float64(3), rows[0].TotalCreditHours, "Credit hours should be 3, not multiplied by number of enrollments")
	assert.Equal(t, 3, rows[0].TotalEnrollments)
	assert.Equal(t, 2, rows[0].ActiveEnrollments)
	assert.Equal(t, 1, rows[0].CompletedEnrollments)
}

func createTestFacility(t *testing.T, env *TestEnv, name string) *models.Facility {
	facility, err := env.CreateTestFacility(name)
	require.NoError(t, err)
	return facility
}

func createTestProgram(t *testing.T, env *TestEnv, name string, facilityID uint) *models.Program {
	program, err := env.CreateTestProgram(
		name,
		models.FederalGrants,
		nil,
		nil,
		true,
		nil,
	)
	require.NoError(t, err)

	err = env.SetFacilitiesToProgram(program.ID, []uint{facilityID})
	require.NoError(t, err)

	programType := models.ProgramType{
		ProgramType: models.Educational,
		ProgramID:   program.ID,
	}
	err = env.DB.Create(&programType).Error
	require.NoError(t, err)

	creditType := models.ProgramCreditType{
		CreditType: models.Education,
		ProgramID:  program.ID,
	}
	err = env.DB.Create(&creditType).Error
	require.NoError(t, err)

	return program
}

func createTestClass(t *testing.T, env *TestEnv, program *models.Program, facility *models.Facility, name string) *models.ProgramClass {
	class, err := env.CreateTestClass(program, facility, models.Active)
	require.NoError(t, err)
	class.Name = name
	err = env.DB.Save(class).Error
	require.NoError(t, err)
	return class
}

func createTestUser(t *testing.T, env *TestEnv, username string, facilityID uint) *models.User {
	user, err := env.CreateTestUser(username, models.Student, facilityID, username+"-123")
	require.NoError(t, err)
	return user
}

func createTestEnrollment(t *testing.T, env *TestEnv, classID, userID uint, status models.ProgramEnrollmentStatus) *models.ProgramClassEnrollment {
	enrolledAt := time.Now().AddDate(0, -1, 0)
	enrollment, err := env.CreateTestEnrollmentWithDates(classID, userID, status, enrolledAt, nil)
	require.NoError(t, err)
	return enrollment
}

func createTestUserWithName(t *testing.T, env *TestEnv, username, lastName, firstName string, facilityID uint, docID string) *models.User {
	user, err := env.CreateTestUser(username, models.Student, facilityID, docID)
	require.NoError(t, err)
	user.NameLast = lastName
	user.NameFirst = firstName
	err = env.DB.Save(user).Error
	require.NoError(t, err)
	return user
}

func TestGetEnrolledResidentsForClass(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility := createTestFacility(t, env, "Test Facility")
	program := createTestProgram(t, env, "Test Program", facility.ID)
	class := createTestClass(t, env, program, facility, "Test Class")

	student1 := createTestUserWithName(t, env, "student1", "Smith", "John", facility.ID, "DOC001")
	student2 := createTestUserWithName(t, env, "student2", "Jones", "Jane", facility.ID, "DOC002")
	student3 := createTestUserWithName(t, env, "student3", "Brown", "Bob", facility.ID, "DOC003")

	createTestEnrollment(t, env, class.ID, student1.ID, models.Enrolled)
	createTestEnrollment(t, env, class.ID, student2.ID, models.Enrolled)

	args := &models.QueryContext{
		Ctx:     context.Background(),
		PerPage: 100,
		Page:    1,
	}

	users, err := env.DB.GetEnrolledResidentsForClass(args, int(class.ID))

	require.NoError(t, err)
	require.Len(t, users, 2, "Should return only 2 enrolled students")

	userIDs := make(map[uint]bool)
	for _, u := range users {
		userIDs[u.ID] = true
		assert.Equal(t, models.Student, u.Role, "All returned users should be students")
	}

	assert.True(t, userIDs[student1.ID], "Student1 should be in results")
	assert.True(t, userIDs[student2.ID], "Student2 should be in results")
	assert.False(t, userIDs[student3.ID], "Student3 should NOT be in results (not enrolled)")
}

func TestGetEnrolledResidentsForClass_ExcludesNonEnrolledStatuses(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility := createTestFacility(t, env, "Test Facility")
	program := createTestProgram(t, env, "Test Program", facility.ID)
	class := createTestClass(t, env, program, facility, "Test Class")

	student1 := createTestUserWithName(t, env, "student1", "Smith", "John", facility.ID, "DOC123")
	student2 := createTestUserWithName(t, env, "student2", "Jones", "Jane", facility.ID, "DOC456")
	student3 := createTestUserWithName(t, env, "student3", "Brown", "Bob", facility.ID, "DOC789")

	createTestEnrollment(t, env, class.ID, student1.ID, models.Enrolled)
	createTestEnrollment(t, env, class.ID, student2.ID, models.EnrollmentCompleted)
	createTestEnrollment(t, env, class.ID, student3.ID, models.EnrollmentIncompleteDropped)

	args := &models.QueryContext{
		Ctx:     context.Background(),
		PerPage: 100,
		Page:    1,
	}

	users, err := env.DB.GetEnrolledResidentsForClass(args, int(class.ID))

	require.NoError(t, err)
	require.Len(t, users, 1, "Should return only actively enrolled student")
	assert.Equal(t, student1.ID, users[0].ID)
}
