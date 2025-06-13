package integration

import (
	"UnlockEdv2/src/handlers"
	"UnlockEdv2/src/models"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

var (
	env *TestEnv
)

func TestGetFacilityHandler(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()

	t.Run("Get facilities when facilities exists", func(t *testing.T) {
		var got []models.Facility

		resp := NewRequest[[]models.Facility](env.Client, t, http.MethodGet, "/api/facilities", nil).
			WithTestClaims(&handlers.Claims{Role: models.SystemAdmin}).
			Do().
			ExpectStatus(http.StatusOK)

		got = resp.GetData()

		require.GreaterOrEqual(t, len(got), 1)
	})

	t.Run("Get facility by id succeeds", func(t *testing.T) {
		facility, err := env.CreateTestFacility("Test Facility")
		require.NoError(t, err)

		var got models.Facility
		resp := NewRequest[models.Facility](env.Client, t, http.MethodGet, fmt.Sprintf("/api/facilities/%d", facility.ID), nil).
			WithTestClaims(&handlers.Claims{Role: models.SystemAdmin}).
			Do().
			ExpectStatus(http.StatusOK)

		got = resp.GetData()

		require.Equal(t, facility.ID, got.ID)
		require.Equal(t, facility.Name, got.Name)
	})
}

func TestCreateFacilityHandler(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()

	t.Run("Create facility succeeds", func(t *testing.T) {
		facility := models.Facility{
			Name:     "Test Facility",
			Timezone: "America/Chicago",
		}

		var got models.Facility

		resp := NewRequest[models.Facility](env.Client, t, http.MethodPost, "/api/facilities", facility).
			WithTestClaims(&handlers.Claims{Role: models.SystemAdmin}).
			Do().
			ExpectStatus(http.StatusCreated)

		got = resp.GetData()

		require.NotZero(t, got.ID)
		require.Equal(t, facility.Name, got.Name)
	})

}

func TestUpdateFacilityHandler(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()
	// Begining of code from James
	t.Run("Update facility fails with invalid data", func(t *testing.T) {
		facility, err := env.CreateTestFacility("Test Facility") // Creating a test facility to update
		require.NoError(t, err)                                  // An assertion to ensure the facility was created successfully

		// Attempt to update with invalid data (e.g., empty name)
		facility.Name = "" // Set an invalid name
		NewRequest[models.Facility](env.Client, t, http.MethodPatch, fmt.Sprintf("/api/facilities/%d", facility.ID), facility).
			WithTestClaims(&handlers.Claims{Role: models.SystemAdmin}).
			Do().
			ExpectStatus(http.StatusBadRequest).
			ExpectMessage("facility name is required") // Expect a specific error message
	})
	t.Run("Update facility fails with non-existent ID", func(t *testing.T) {
		// Attempt to update a facility that does not exist
		nonExistentID := 9999 // Assuming this ID does not exist
		facility := models.Facility{
			Name:     "Non-existent Facility",
			Timezone: "America/Chicago",
		}
		NewRequest[models.Facility](env.Client, t, http.MethodPatch, fmt.Sprintf("/api/facilities/%d", nonExistentID), facility).
			WithTestClaims(&handlers.Claims{Role: models.SystemAdmin}).
			Do().
			ExpectStatus(http.StatusNotFound).
			ExpectMessage("facility not found") // Expect a specific error message for non-existent facility
	})
	// I think this is a good place to add a test for successful update, but I'm not sure if it should be here or in a separate function.
	// END OF CODE FROM JAMES
	t.Run("Update facility succeeds", func(t *testing.T) {
		facility, err := env.CreateTestFacility("Test Facility")
		require.NoError(t, err)

		facility.Name = "Updated Facility"

		NewRequest[models.Facility](env.Client, t, http.MethodPatch, fmt.Sprintf("/api/facilities/%d", facility.ID), facility).
			WithTestClaims(&handlers.Claims{Role: models.SystemAdmin}).
			Do().
			ExpectStatus(http.StatusOK).
			ExpectMessage("facility updated successfully")
	})
}
