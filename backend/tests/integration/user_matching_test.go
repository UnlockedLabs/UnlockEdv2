package integration

import (
	"UnlockEdv2/src/models"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetAllUnmappedUsers(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Match Test Facility")
	require.NoError(t, err)

	provider := &models.ProviderPlatform{
		Name:      "Test Canvas",
		Type:      models.CanvasCloud,
		BaseUrl:   "https://canvas.example.com",
		AccountID: "1",
		AccessKey: "test-key",
		State:     models.Enabled,
	}
	require.NoError(t, env.DB.Create(provider).Error)

	u1, err := env.CreateTestUser("studentone", models.Student, facility.ID, "")
	require.NoError(t, err)
	u2, err := env.CreateTestUser("studenttwo", models.Student, facility.ID, "")
	require.NoError(t, err)
	_, err = env.CreateTestUser("studentthree", models.Student, facility.ID, "")
	require.NoError(t, err)

	require.NoError(t, env.DB.CreateProviderUserMapping(&models.ProviderUserMapping{
		UserID:             u1.ID,
		ProviderPlatformID: provider.ID,
		ExternalUserID:     "ext1",
		ExternalUsername:   "ext_u1",
	}))
	require.NoError(t, env.DB.CreateProviderUserMapping(&models.ProviderUserMapping{
		UserID:             u2.ID,
		ProviderPlatformID: provider.ID,
		ExternalUserID:     "ext2",
		ExternalUsername:   "ext_u2",
	}))

	users, err := env.DB.GetAllUnmappedUsers(int(provider.ID), facility.ID)
	require.NoError(t, err)
	require.Len(t, users, 1)
	require.Equal(t, "studentthree", users[0].Username)
}
