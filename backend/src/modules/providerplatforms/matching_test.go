package providerplatforms

import (
	"fmt"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// openTestDB is a new in-memory database with Provider Platforms' tables and a
// users table, closed when the test ends.
func openTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:providerplatforms_%d?mode=memory&cache=shared", time.Now().UnixNano())), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	require.NoError(t, db.AutoMigrate(append(Module{}.TestModels(), &user{})...))
	return db
}

func TestGetAllUnmappedUsers(t *testing.T) {
	db := openTestDB(t)
	s := &store{db: db}

	provider := &ProviderPlatform{
		Name:      "Test Canvas",
		Type:      CanvasCloud,
		BaseUrl:   "https://canvas.example.com",
		AccountID: "1",
		AccessKey: "test-key",
		State:     Enabled,
	}
	require.NoError(t, db.Create(provider).Error)

	const facilityID = 1
	students := []user{
		{Username: "studentone", Role: "student", FacilityID: facilityID},
		{Username: "studenttwo", Role: "student", FacilityID: facilityID},
		{Username: "studentthree", Role: "student", FacilityID: facilityID},
		{Username: "elsewhere", Role: "student", FacilityID: facilityID + 1},
	}
	require.NoError(t, db.Create(&students).Error)

	for i, u := range students[:2] {
		require.NoError(t, s.createProviderUserMapping(&ProviderUserMapping{
			UserID:             u.ID,
			ProviderPlatformID: provider.ID,
			ExternalUserID:     fmt.Sprintf("ext%d", i+1),
			ExternalUsername:   fmt.Sprintf("ext_u%d", i+1),
		}))
	}

	users, err := s.getAllUnmappedUsers(int(provider.ID), facilityID)
	require.NoError(t, err)
	require.Len(t, users, 1)
	require.Equal(t, "studentthree", users[0].Username)
}

func TestNameSimilarity(t *testing.T) {
	require.Equal(t, 1.0, nameSimilarity("John Smith", "John Smith"))
	require.Equal(t, 1.0, nameSimilarity("  JOHN SMITH ", "john smith"))

	score := nameSimilarity("John Smith", "Jon Smith")
	require.Greater(t, score, 0.85)
	require.Less(t, score, 1.0)

	score2 := nameSimilarity("John Smith", "Zyx Qwerty")
	t.Logf("composite score John Smith vs Zyx Qwerty: %.4f", score2)
	require.Less(t, score2, 0.60)
}

func TestMatchUsersOneToOne(t *testing.T) {
	canvas := []ImportUser{
		{NameFirst: "John", NameLast: "Smith", ExternalUserID: "c1"},
		{NameFirst: "John", NameLast: "Smith", ExternalUserID: "c2"},
	}
	unlocked := []user{
		{NameFirst: "John", NameLast: "Smith"},
	}
	unlocked[0].ID = 1

	result := matchUsers(canvas, unlocked)

	total := len(result.AutoConfirmed) + len(result.Ambiguous) + len(result.Unmatched)
	require.Equal(t, 2, total)
	require.Equal(t, 1, len(result.AutoConfirmed))
	require.Equal(t, 1, len(result.Unmatched))
}

func TestMatchUsers(t *testing.T) {
	canvas := []ImportUser{
		{NameFirst: "John", NameLast: "Smith", ExternalUserID: "c1"},
		{NameFirst: "Marie", NameLast: "Laberge", ExternalUserID: "c2"},
		{NameFirst: "Zyx", NameLast: "Qwerty", ExternalUserID: "c3"},
	}
	unlocked := []user{
		{NameFirst: "John", NameLast: "Smith"},
		{NameFirst: "Marie", NameLast: "Lambert"},
		{NameFirst: "Alice", NameLast: "Jones"},
	}
	unlocked[0].ID = 1
	unlocked[1].ID = 2
	unlocked[2].ID = 3

	result := matchUsers(canvas, unlocked)

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
