package integration

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"testing"
	"time"

	"UnlockEdv2/src/handlers"
	"UnlockEdv2/src/models"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

func TestCreateClassHandler(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Test Facility")
	require.NoError(t, err)

	facilityAdmin, err := env.CreateTestUser("testadmin", models.FacilityAdmin, facility.ID, "")
	require.NoError(t, err)

	// - [x] Create class when request is valid
	// - [ ] Create class at facility not offered is invalid
	// - [ ] Bad request when program id is invalid
	// - [ ] Internal service error when program id isn't found
	// - [x] Status conflict when program is inactive or archived

	t.Run("Create class when request is valid", func(t *testing.T) {
		runCreateClassTest(t, env, facility, facilityAdmin)
	})

	t.Run("Create class for inactive program is invalid", func(t *testing.T) {
		runCreateClassInactiveProgramTest(t, env, facility, facilityAdmin)
	})
}

// successful class is created
func runCreateClassTest(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User) {
	program, err := env.CreateTestProgram("Test Program", models.FundingType(models.FederalGrants), []models.ProgramType{}, []models.ProgramCreditType{}, true)
	require.NoError(t, err)

	err = env.SetFacilitiesToProgram(program.ID, []uint{facility.ID})
	require.NoError(t, err)

	class := newClass(program, facility)

	resp := NewRequest[*models.ProgramClass](env.Client, t, http.MethodPost, fmt.Sprintf("/api/programs/%d/classes", program.ID), class).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusCreated)

	got := resp.GetData()

	require.NotZero(t, got.ID)
	require.Equal(t, class.Name, got.Name)
	require.Equal(t, class.InstructorName, got.InstructorName)
	require.Equal(t, class.Description, got.Description)
	require.WithinDuration(t, class.StartDt, got.StartDt, time.Millisecond)
	require.WithinDuration(t, *class.EndDt, *got.EndDt, time.Millisecond)
	require.Equal(t, class.Status, got.Status)
	require.Equal(t, class.CreditHours, got.CreditHours)
}

func runCreateClassInactiveProgramTest(t *testing.T, env *TestEnv, facility *models.Facility, facilityAdmin *models.User) {
	program, err := env.CreateTestProgram("Inactive Program", models.FundingType(models.FederalGrants), []models.ProgramType{}, []models.ProgramCreditType{}, false)
	require.NoError(t, err)

	class := newClass(program, facility)

	NewRequest[*models.ProgramClass](env.Client, t, http.MethodPost, fmt.Sprintf("/api/programs/%d/classes", program.ID), class).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, UserID: facilityAdmin.ID}).
		Do().
		ExpectStatus(http.StatusUnauthorized)
}

// creates a boilerplate class
func newClass(program *models.Program, facility *models.Facility) models.ProgramClass {
	endDt := time.Now().Add(time.Hour * 24)
	creditHours := int64(2)

	class := models.ProgramClass{
		ProgramID:      program.ID,
		FacilityID:     facility.ID,
		Capacity:       10,
		Name:           "Test Class",
		InstructorName: "Test Instructor",
		Description:    "This is a test class created for integration testing purposes.",
		StartDt:        time.Now(),
		EndDt:          &endDt,
		Status:         models.Scheduled,
		CreditHours:    &creditHours,
	}
	return class
}

func TestMain(m *testing.M) {
	logrus.SetOutput(io.Discard)
	code := m.Run()
	os.Exit(code)
}
