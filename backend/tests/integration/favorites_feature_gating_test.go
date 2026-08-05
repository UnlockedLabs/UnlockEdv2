package integration

import (
	"UnlockEdv2/src/models"
	"testing"

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
	kiwix := &models.OpenContentProvider{Title: "Kiwix", Url: "http://kiwix-fav", CurrentlyEnabled: true}
	require.NoError(t, env.DB.Create(kiwix).Error)
	youtube := &models.OpenContentProvider{Title: "YouTube", Url: "http://youtube-fav", CurrentlyEnabled: true}
	require.NoError(t, env.DB.Create(youtube).Error)
	linksProvider := &models.OpenContentProvider{Title: models.HelpfulLinks, Url: "helpful_links_fav", CurrentlyEnabled: true}
	require.NoError(t, env.DB.Create(linksProvider).Error)

	library := &models.Library{OpenContentProviderID: kiwix.ID, Title: "Fav Library", Url: "/fav-library"}
	require.NoError(t, env.DB.Create(library).Error)
	video := &models.Video{
		OpenContentProviderID: youtube.ID,
		Title:                 "Fav Video",
		Url:                   "/fav-video",
		ExternalID:            "fav-vid-1",
		Availability:          models.VideoAvailable,
	}
	require.NoError(t, env.DB.Create(video).Error)
	link := &models.HelpfulLink{
		OpenContentProviderID: linksProvider.ID,
		Title:                 "Fav Link",
		Url:                   "https://example.org/fav-link",
		Description:           "a link",
	}
	require.NoError(t, env.DB.Create(link).Error)

	for _, fav := range []models.OpenContentFavorite{
		{UserID: user.ID, ContentID: library.ID, OpenContentProviderID: kiwix.ID, FacilityID: &facility.ID},
		{UserID: user.ID, ContentID: video.ID, OpenContentProviderID: youtube.ID, FacilityID: &facility.ID},
		{UserID: user.ID, ContentID: link.ID, OpenContentProviderID: linksProvider.ID, FacilityID: &facility.ID},
	} {
		require.NoError(t, env.DB.Create(&fav).Error)
	}

	argsWith := func(features ...models.FeatureAccess) *models.QueryContext {
		return &models.QueryContext{
			Ctx:           env.Context,
			UserID:        user.ID,
			FacilityID:    facility.ID,
			Page:          1,
			PerPage:       50,
			FeatureAccess: features,
		}
	}
	types := func(items []models.OpenContentItem) map[string]bool {
		seen := map[string]bool{}
		for _, i := range items {
			seen[i.ContentType] = true
		}
		return seen
	}

	all := []models.FeatureAccess{models.OpenContentAccess, models.UploadVideoAccess, models.HelpfulLinksAccess}

	t.Run("all sub-features on returns every content type", func(t *testing.T) {
		favs, err := env.DB.GetUserFavorites(argsWith(all...))
		require.NoError(t, err)
		got := types(favs)
		require.True(t, got["library"], "library must be present")
		require.True(t, got["video"], "video must be present")
		require.True(t, got["helpful_link"], "helpful link must be present")

		groupings, err := env.DB.GetUserFavoriteGroupings(argsWith(all...))
		require.NoError(t, err)
		got = types(groupings)
		require.True(t, got["library"])
		require.True(t, got["video"])
		require.True(t, got["helpful_link"])
	})

	t.Run("upload_video off hides favorited videos but keeps libraries", func(t *testing.T) {
		args := argsWith(models.OpenContentAccess, models.HelpfulLinksAccess)
		favs, err := env.DB.GetUserFavorites(args)
		require.NoError(t, err)
		got := types(favs)
		require.False(t, got["video"], "a favorited video must not leak while upload_video is off")
		require.True(t, got["library"], "libraries must still come back")
		require.True(t, got["helpful_link"], "helpful links must still come back")

		groupings, err := env.DB.GetUserFavoriteGroupings(argsWith(models.OpenContentAccess, models.HelpfulLinksAccess))
		require.NoError(t, err)
		got = types(groupings)
		require.False(t, got["video"])
		require.True(t, got["library"])
		require.True(t, got["helpful_link"])
	})

	t.Run("helpful_links off hides favorited links but keeps libraries", func(t *testing.T) {
		args := argsWith(models.OpenContentAccess, models.UploadVideoAccess)
		favs, err := env.DB.GetUserFavorites(args)
		require.NoError(t, err)
		got := types(favs)
		require.False(t, got["helpful_link"], "a favorited helpful link must not leak while helpful_links is off")
		require.True(t, got["library"])
		require.True(t, got["video"])

		groupings, err := env.DB.GetUserFavoriteGroupings(argsWith(models.OpenContentAccess, models.UploadVideoAccess))
		require.NoError(t, err)
		got = types(groupings)
		require.False(t, got["helpful_link"])
		require.True(t, got["library"])
		require.True(t, got["video"])
	})

	t.Run("both sub-features off still returns libraries", func(t *testing.T) {
		args := argsWith(models.OpenContentAccess)
		favs, err := env.DB.GetUserFavorites(args)
		require.NoError(t, err)
		got := types(favs)
		require.True(t, got["library"], "over-filtering would break the parent feature entirely")
		require.False(t, got["video"])
		require.False(t, got["helpful_link"])
	})

	t.Run("hiding is not deleting - re-enabling restores the favorites", func(t *testing.T) {
		favs, err := env.DB.GetUserFavorites(argsWith(all...))
		require.NoError(t, err)
		got := types(favs)
		require.True(t, got["video"], "the favorite row must survive being filtered out")
		require.True(t, got["helpful_link"])
	})
}
