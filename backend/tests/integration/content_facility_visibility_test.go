package integration

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/handlers"
	"UnlockEdv2/src/models"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestVideoFacilityVisibility(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facilityA, err := env.CreateTestFacility("Video Facility A")
	require.NoError(t, err)
	facilityB, err := env.CreateTestFacility("Video Facility B")
	require.NoError(t, err)

	youtube := &models.OpenContentProvider{Title: "YouTube", Url: "http://youtube"}
	require.NoError(t, env.DB.Create(youtube).Error)
	video := &models.Video{OpenContentProviderID: youtube.ID, Title: "Test Video", Url: "/vid", ExternalID: "vid1"}
	require.NoError(t, env.DB.Create(video).Error)

	deptAdmin, err := env.CreateTestUser("videodept", models.DepartmentAdmin, facilityA.ID, "")
	require.NoError(t, err)
	facAdmin, err := env.CreateTestUser("videofac", models.FacilityAdmin, facilityA.ID, "")
	require.NoError(t, err)
	deptClaims := &handlers.Claims{UserID: deptAdmin.ID, Role: models.DepartmentAdmin, FacilityID: facilityA.ID}
	facClaims := &handlers.Claims{UserID: facAdmin.ID, Role: models.FacilityAdmin, FacilityID: facilityA.ID}
	visibilityURL := fmt.Sprintf("/api/videos/%d/facilities", video.ID)

	t.Run("dept admin sets video visibility per facility", func(t *testing.T) {
		rows := NewRequest[[]database.ContentFacilityVisibility](env.Client, t, http.MethodGet, visibilityURL, nil).
			WithTestClaims(deptClaims).Do().
			ExpectStatus(http.StatusOK).GetData()
		require.GreaterOrEqual(t, len(rows), 2)
		for _, row := range rows {
			require.False(t, row.VisibilityStatus)
		}

		NewRequest[any](env.Client, t, http.MethodPut, visibilityURL, map[string]any{
			"facility_ids":      []uint{facilityA.ID},
			"visibility_status": true,
		}).WithTestClaims(deptClaims).Do().ExpectStatus(http.StatusOK)

		rows = NewRequest[[]database.ContentFacilityVisibility](env.Client, t, http.MethodGet, visibilityURL, nil).
			WithTestClaims(deptClaims).Do().
			ExpectStatus(http.StatusOK).GetData()
		require.GreaterOrEqual(t, len(rows), 2)
		for _, row := range rows {
			require.Equal(t, row.FacilityID == facilityA.ID, row.VisibilityStatus)
		}
	})

	t.Run("video list includes visible facility count", func(t *testing.T) {
		vids := NewRequest[[]database.VideoResponse](env.Client, t, http.MethodGet,
			"/api/videos?visibility=all", nil).
			WithTestClaims(deptClaims).Do().
			ExpectStatus(http.StatusOK).GetData()
		require.Len(t, vids, 1)
		require.Equal(t, 1, vids[0].VisibleFacilityCount)
	})

	t.Run("facility admin cannot access video facility endpoints", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodGet, visibilityURL, nil).
			WithTestClaims(facClaims).Do().ExpectStatus(http.StatusUnauthorized)
		NewRequest[any](env.Client, t, http.MethodPut, visibilityURL, map[string]any{
			"facility_ids":      []uint{facilityA.ID},
			"visibility_status": false,
		}).WithTestClaims(facClaims).Do().ExpectStatus(http.StatusUnauthorized)
	})

	t.Run("facility admin toggle still works for own facility", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodPut,
			fmt.Sprintf("/api/videos/%d/visibility", video.ID), map[string]any{}).
			WithTestClaims(facClaims).Do().ExpectStatus(http.StatusOK)

		rows := NewRequest[[]database.ContentFacilityVisibility](env.Client, t, http.MethodGet, visibilityURL, nil).
			WithTestClaims(deptClaims).Do().
			ExpectStatus(http.StatusOK).GetData()
		require.GreaterOrEqual(t, len(rows), 2)
		for _, row := range rows {
			require.False(t, row.VisibilityStatus)
		}
		_ = facilityB
	})
}

func TestHelpfulLinkFacilityVisibility(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facilityA, err := env.CreateTestFacility("Link Facility A")
	require.NoError(t, err)
	facilityB, err := env.CreateTestFacility("Link Facility B")
	require.NoError(t, err)

	provider := &models.OpenContentProvider{Title: models.HelpfulLinks, Url: "helpful_links"}
	require.NoError(t, env.DB.Create(provider).Error)

	deptAdmin, err := env.CreateTestUser("linkdept", models.DepartmentAdmin, facilityA.ID, "")
	require.NoError(t, err)
	facAdminA, err := env.CreateTestUser("linkfaca", models.FacilityAdmin, facilityA.ID, "")
	require.NoError(t, err)
	facAdminB, err := env.CreateTestUser("linkfacb", models.FacilityAdmin, facilityB.ID, "")
	require.NoError(t, err)
	deptClaims := &handlers.Claims{UserID: deptAdmin.ID, Role: models.DepartmentAdmin, FacilityID: facilityA.ID}
	facClaimsA := &handlers.Claims{UserID: facAdminA.ID, Role: models.FacilityAdmin, FacilityID: facilityA.ID}
	facClaimsB := &handlers.Claims{UserID: facAdminB.ID, Role: models.FacilityAdmin, FacilityID: facilityB.ID}

	t.Run("facility admin adds a link visible at own facility only", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodPut, "/api/helpful-links", map[string]any{
			"title": "Khan", "url": "https://khanacademy.org", "description": "learning",
		}).WithTestClaims(facClaimsA).Do().ExpectStatus(http.StatusCreated)
	})

	var link models.HelpfulLink
	require.NoError(t, env.DB.First(&link, "url = ?", "https://khanacademy.org").Error)
	visibilityURL := fmt.Sprintf("/api/helpful-links/facilities/%d", link.ID)

	t.Run("link is visible at creator facility, hidden elsewhere", func(t *testing.T) {
		rows := NewRequest[[]database.ContentFacilityVisibility](env.Client, t, http.MethodGet, visibilityURL, nil).
			WithTestClaims(deptClaims).Do().
			ExpectStatus(http.StatusOK).GetData()
		require.GreaterOrEqual(t, len(rows), 2)
		for _, row := range rows {
			require.Equal(t, row.FacilityID == facilityA.ID, row.VisibilityStatus)
		}
	})

	t.Run("dept admin extends link visibility to another facility", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodPut, visibilityURL, map[string]any{
			"facility_ids":      []uint{facilityB.ID},
			"visibility_status": true,
		}).WithTestClaims(deptClaims).Do().ExpectStatus(http.StatusOK)

		type linkList struct {
			Links []database.HelpfulLinkResp `json:"helpful_links"`
		}
		resp := NewRequest[linkList](env.Client, t, http.MethodGet, "/api/helpful-links?visibility=true", nil).
			WithTestClaims(facClaimsB).Do().
			ExpectStatus(http.StatusOK).GetData()
		require.Len(t, resp.Links, 1)
		require.True(t, resp.Links[0].VisibilityStatus)
		require.Equal(t, 2, resp.Links[0].VisibleFacilityCount)
	})

	t.Run("facility admin toggles link at own facility only", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodPut,
			fmt.Sprintf("/api/helpful-links/toggle/%d", link.ID), map[string]any{}).
			WithTestClaims(facClaimsA).Do().ExpectStatus(http.StatusOK)

		rows := NewRequest[[]database.ContentFacilityVisibility](env.Client, t, http.MethodGet, visibilityURL, nil).
			WithTestClaims(deptClaims).Do().
			ExpectStatus(http.StatusOK).GetData()
		require.GreaterOrEqual(t, len(rows), 2)
		for _, row := range rows {
			require.Equal(t, row.FacilityID == facilityB.ID, row.VisibilityStatus)
		}
	})

	t.Run("facility admin cannot access link facility endpoints", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodGet, visibilityURL, nil).
			WithTestClaims(facClaimsA).Do().ExpectStatus(http.StatusUnauthorized)
		NewRequest[any](env.Client, t, http.MethodPut, visibilityURL, map[string]any{
			"facility_ids":      []uint{facilityA.ID},
			"visibility_status": true,
		}).WithTestClaims(facClaimsA).Do().ExpectStatus(http.StatusUnauthorized)
	})

	t.Run("deleting a link cleans up visibility rows", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodDelete,
			fmt.Sprintf("/api/helpful-links/%d", link.ID), nil).
			WithTestClaims(facClaimsA).Do().ExpectStatus(http.StatusOK)

		var count int64
		require.NoError(t, env.DB.Model(&models.FacilityVisibilityStatus{}).
			Where("content_id = ? AND open_content_provider_id = ?", link.ID, link.OpenContentProviderID).
			Count(&count).Error)
		require.Zero(t, count)
	})
}
