package integration

import (
	"UnlockEdv2/src/handlers"
	"UnlockEdv2/src/models"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCreateUserHandler(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	t.Run("Create user succeeds", func(t *testing.T) {
		facility, err := env.CreateTestFacility("Test Facility")
		require.NoError(t, err)

		var form struct {
			User      models.User `json:"user"`
			Providers []int       `json:"provider_platforms"`
		}

		form.User = models.User{
			Username:   "testuser",
			NameFirst:  "Test",
			NameLast:   "User",
			Role:       models.Student,
			Email:      "testuser@example.com",
			DocID:      "123456789",
			FacilityID: facility.ID,
		}

		resp := NewRequest[struct {
			User models.User `json:"user"`
		}](env.Client, t, http.MethodPost, "/api/users", form).
			WithTestClaims(&handlers.Claims{Role: models.SystemAdmin}).
			Do().
			ExpectStatus(http.StatusCreated)

		got := resp.GetData().User

		require.NotZero(t, got.ID)
		require.Equal(t, form.User.Username, got.Username)
		require.Equal(t, form.User.NameFirst, got.NameFirst)
		require.Equal(t, form.User.NameLast, got.NameLast)
		require.Equal(t, form.User.Role, got.Role)
		require.Equal(t, form.User.Email, got.Email)
		require.Equal(t, form.User.DocID, got.DocID)
		require.Equal(t, form.User.FacilityID, got.FacilityID)
	})
}
