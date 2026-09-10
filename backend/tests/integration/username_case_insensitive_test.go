package integration

import (
	"UnlockEdv2/src/models"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// ID-849: username lookup used during login must be case-insensitive, since
// username uniqueness is already enforced case-insensitively at create time
// (see UserIdentityExists). This exercises GetUserByUsername directly rather
// than the full login handler/Kratos round trip.
func TestGetUserByUsernameCaseInsensitive(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Case Insensitive Test Facility")
	require.NoError(t, err)

	created, err := env.CreateTestUser("CaseTestUser", models.Student, facility.ID, "")
	require.NoError(t, err)

	t.Run("matches stored casing", func(t *testing.T) {
		got, err := env.DB.GetUserByUsername("CaseTestUser")
		require.NoError(t, err)
		require.Equal(t, created.ID, got.ID)
		require.Equal(t, "CaseTestUser", got.Username, "stored/display casing must be unchanged")
	})

	t.Run("matches all-lowercase", func(t *testing.T) {
		got, err := env.DB.GetUserByUsername("casetestuser")
		require.NoError(t, err)
		require.Equal(t, created.ID, got.ID)
	})

	t.Run("matches all-uppercase", func(t *testing.T) {
		got, err := env.DB.GetUserByUsername("CASETESTUSER")
		require.NoError(t, err)
		require.Equal(t, created.ID, got.ID)
	})

	t.Run("absent username still not found", func(t *testing.T) {
		_, err := env.DB.GetUserByUsername("definitelynotarealuser")
		require.Error(t, err)
		require.True(t, errors.Is(err, gorm.ErrRecordNotFound))
	})
}
