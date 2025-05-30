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
