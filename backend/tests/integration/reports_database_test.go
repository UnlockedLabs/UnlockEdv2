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
