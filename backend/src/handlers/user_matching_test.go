package handlers

import (
	"UnlockEdv2/src/models"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLevenshtein(t *testing.T) {
	require.Equal(t, 0, levenshtein("john", "john"))
	require.Equal(t, 1, levenshtein("john", "jon"))
	require.Equal(t, 4, levenshtein("john", "mary"))
}

func TestNameSimilarity(t *testing.T) {
	require.Equal(t, 1.0, nameSimilarity("John Smith", "John Smith"))
	require.Equal(t, 1.0, nameSimilarity("  JOHN SMITH ", "john smith"))
	score := nameSimilarity("John Smith", "Jon Smith")
	require.Greater(t, score, 0.85)
	require.Less(t, score, 1.0)
	score2 := nameSimilarity("John Smith", "Alice Jones")
	require.Less(t, score2, 0.50)
}

func TestMatchUsers(t *testing.T) {
	// "Marie Laberge" vs "Marie Lambert" = 5 edits over 13 chars ≈ 0.615 → ambiguous
	canvas := []models.ImportUser{
		{NameFirst: "John", NameLast: "Smith", ExternalUserID: "c1"},
		{NameFirst: "Marie", NameLast: "Laberge", ExternalUserID: "c2"},
		{NameFirst: "Zyx", NameLast: "Qwerty", ExternalUserID: "c3"},
	}
	unlocked := []models.User{
		{NameFirst: "John", NameLast: "Smith"},    // exact → auto-confirmed
		{NameFirst: "Marie", NameLast: "Lambert"}, // close but < 0.90 → ambiguous
		{NameFirst: "Alice", NameLast: "Jones"},   // no match → unmatched
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
