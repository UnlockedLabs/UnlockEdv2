package integration

import (
	"UnlockEdv2/src/handlers"
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

func TestNameSimilarity(t *testing.T) {
	require.Equal(t, 1.0, handlers.NameSimilarity("John Smith", "John Smith"))
	require.Equal(t, 1.0, handlers.NameSimilarity("  JOHN SMITH ", "john smith"))

	score := handlers.NameSimilarity("John Smith", "Jon Smith")
	require.Greater(t, score, 0.85)
	require.Less(t, score, 1.0)

	score2 := handlers.NameSimilarity("John Smith", "Zyx Qwerty")
	t.Logf("composite score John Smith vs Zyx Qwerty: %.4f", score2)
	require.Less(t, score2, 0.60)
}

func TestMatchUsersOneToOne(t *testing.T) {
	canvas := []models.ImportUser{
		{NameFirst: "John", NameLast: "Smith", ExternalUserID: "c1"},
		{NameFirst: "John", NameLast: "Smith", ExternalUserID: "c2"},
	}
	unlocked := []models.User{
		{NameFirst: "John", NameLast: "Smith"},
	}
	unlocked[0].ID = 1

	result := handlers.MatchUsers(canvas, unlocked)

	total := len(result.AutoConfirmed) + len(result.Ambiguous) + len(result.Unmatched)
	require.Equal(t, 2, total)
	require.Equal(t, 1, len(result.AutoConfirmed))
	require.Equal(t, 1, len(result.Unmatched))
}

func TestMatchUsers(t *testing.T) {
	canvas := []models.ImportUser{
		{NameFirst: "John", NameLast: "Smith", ExternalUserID: "c1"},
		{NameFirst: "Marie", NameLast: "Laberge", ExternalUserID: "c2"},
		{NameFirst: "Zyx", NameLast: "Qwerty", ExternalUserID: "c3"},
	}
	unlocked := []models.User{
		{NameFirst: "John", NameLast: "Smith"},
		{NameFirst: "Marie", NameLast: "Lambert"},
		{NameFirst: "Alice", NameLast: "Jones"},
	}
	unlocked[0].ID = 1
	unlocked[1].ID = 2
	unlocked[2].ID = 3

	result := handlers.MatchUsers(canvas, unlocked)

	require.Len(t, result.AutoConfirmed, 1)
	require.Equal(t, "c1", result.AutoConfirmed[0].CanvasUser.ExternalUserID)
	require.Equal(t, 1.0, result.AutoConfirmed[0].Score)

	require.Len(t, result.Ambiguous, 1)
	require.Equal(t, "c2", result.Ambiguous[0].CanvasUser.ExternalUserID)
	require.Greater(t, result.Ambiguous[0].Score, 0.50)
	require.Less(t, result.Ambiguous[0].Score, 0.90)

	require.Len(t, result.Unmatched, 1)
	require.Equal(t, "c3", result.Unmatched[0].ExternalUserID)
}
