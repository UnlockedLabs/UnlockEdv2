package integration

import (
	"net/http"
	"testing"
	"time"

	"github.com/UnlockedLabs/unlocked-core/backend/src/handlers"
	"github.com/UnlockedLabs/unlocked-core/backend/src/models"

	"github.com/stretchr/testify/require"
)

// A favorited video or helpful link must not come back from the favorites
// queries when its sub-feature is disabled for the caller's facility. Both
// routes are gated on the parent (open_content) only — that gate has to stay on
// for libraries — so without a per-content-type filter the card metadata leaks
// even though /api/videos and /api/helpful-links correctly 401.
func TestUserFavorites_RespectSubFeatureAccess(t *testing.T) {
	env = SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Favorites Gating Facility")
	require.NoError(t, err)
	user, err := env.CreateTestUser("favgating", models.Student, facility.ID, "")
	require.NoError(t, err)

	// The favorites queries join on currently_enabled = TRUE, so these have to be
	// enabled or every branch comes back empty.
	kiwixID := env.InsertReturningID(t, `INSERT INTO open_content_providers (title, url, currently_enabled) VALUES ('Kiwix', 'http://kiwix-fav', true)`)
	youtubeID := env.InsertReturningID(t, `INSERT INTO open_content_providers (title, url, currently_enabled) VALUES ('YouTube', 'http://youtube-fav', true)`)
	linksProviderID := env.InsertReturningID(t, `INSERT INTO open_content_providers (title, url, currently_enabled) VALUES ('HelpfulLinks', 'https://helpful_links_fav', true)`)

	libraryID := env.InsertReturningID(t, `INSERT INTO libraries (open_content_provider_id, title, url) VALUES (?, 'Fav Library', '/fav-library')`, kiwixID)
	videoID := env.InsertReturningID(t, `INSERT INTO videos (open_content_provider_id, title, url, external_id, availability) VALUES (?, 'Fav Video', '/fav-video', 'fav-vid-1', 'available')`, youtubeID)
	linkID := env.InsertReturningID(t, `INSERT INTO helpful_links (open_content_provider_id, title, url, description) VALUES (?, 'Fav Link', 'https://example.org/fav-link', 'a link')`, linksProviderID)

	for _, fav := range [][2]uint{{libraryID, kiwixID}, {videoID, youtubeID}, {linkID, linksProviderID}} {
		require.NoError(t, env.DB.Exec(`INSERT INTO open_content_favorites (user_id, content_id, open_content_provider_id, facility_id, created_at) VALUES (?, ?, ?, ?, ?)`,
			user.ID, fav[0], fav[1], facility.ID, time.Now()).Error)
	}

	type favorite struct {
		ContentType string `json:"content_type"`
	}
	types := func(items []favorite) map[string]bool {
		seen := map[string]bool{}
		for _, i := range items {
			seen[i.ContentType] = true
		}
		return seen
	}
	// favoritesWith calls both favorites routes as the user, with only the
	// given features on.
	favoritesWith := func(t *testing.T, features ...models.FeatureAccess) (favs, groupings map[string]bool) {
		claims := &handlers.Claims{UserID: user.ID, Role: models.Student, FacilityID: facility.ID, FeatureAccess: features}
		favs = types(NewRequest[[]favorite](env.Client, t, http.MethodGet, "/api/open-content/favorites?per_page=50", nil).
			WithTestClaims(claims).Do().ExpectStatus(http.StatusOK).GetData())
		groupings = types(NewRequest[[]favorite](env.Client, t, http.MethodGet, "/api/open-content/favorite-groupings", nil).
			WithTestClaims(claims).Do().ExpectStatus(http.StatusOK).GetData())
		return favs, groupings
	}

	all := []models.FeatureAccess{models.OpenContentAccess, models.UploadVideoAccess, models.HelpfulLinksAccess}

	t.Run("all sub-features on returns every content type", func(t *testing.T) {
		got, groupings := favoritesWith(t, all...)
		require.True(t, got["library"], "library must be present")
		require.True(t, got["video"], "video must be present")
		require.True(t, got["helpful_link"], "helpful link must be present")

		require.True(t, groupings["library"])
		require.True(t, groupings["video"])
		require.True(t, groupings["helpful_link"])
	})

	t.Run("upload_video off hides favorited videos but keeps libraries", func(t *testing.T) {
		got, groupings := favoritesWith(t, models.OpenContentAccess, models.HelpfulLinksAccess)
		require.False(t, got["video"], "a favorited video must not leak while upload_video is off")
		require.True(t, got["library"], "libraries must still come back")
		require.True(t, got["helpful_link"], "helpful links must still come back")

		require.False(t, groupings["video"])
		require.True(t, groupings["library"])
		require.True(t, groupings["helpful_link"])
	})

	t.Run("helpful_links off hides favorited links but keeps libraries", func(t *testing.T) {
		got, groupings := favoritesWith(t, models.OpenContentAccess, models.UploadVideoAccess)
		require.False(t, got["helpful_link"], "a favorited helpful link must not leak while helpful_links is off")
		require.True(t, got["library"])
		require.True(t, got["video"])

		require.False(t, groupings["helpful_link"])
		require.True(t, groupings["library"])
		require.True(t, groupings["video"])
	})

	t.Run("both sub-features off still returns libraries", func(t *testing.T) {
		got, _ := favoritesWith(t, models.OpenContentAccess)
		require.True(t, got["library"], "over-filtering would break the parent feature entirely")
		require.False(t, got["video"])
		require.False(t, got["helpful_link"])
	})

	t.Run("hiding is not deleting - re-enabling restores the favorites", func(t *testing.T) {
		got, _ := favoritesWith(t, all...)
		require.True(t, got["video"], "the favorite row must survive being filtered out")
		require.True(t, got["helpful_link"])
	})
}
