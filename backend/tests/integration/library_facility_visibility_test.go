package integration

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/UnlockedLabs/unlocked-core/backend/src/handlers"
	"github.com/UnlockedLabs/unlocked-core/backend/src/models"

	"github.com/stretchr/testify/require"
)

func TestLibraryFacilityVisibility(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facilityA, err := env.CreateTestFacility("Facility A")
	require.NoError(t, err)
	facilityB, err := env.CreateTestFacility("Facility B")
	require.NoError(t, err)
	facilityC, err := env.CreateTestFacility("Facility C")
	require.NoError(t, err)

	kiwixID := env.InsertReturningID(t, `INSERT INTO open_content_providers (title, url, currently_enabled) VALUES ('Kiwix', 'http://kiwix', false)`)
	libraryID := env.InsertReturningID(t, `INSERT INTO libraries (open_content_provider_id, title, url) VALUES (?, 'Test Library', '/test')`, kiwixID)

	deptAdmin, err := env.CreateTestUser("deptadmin", models.DepartmentAdmin, facilityA.ID, "")
	require.NoError(t, err)
	facAdmin, err := env.CreateTestUser("facadmin", models.FacilityAdmin, facilityA.ID, "")
	require.NoError(t, err)

	deptClaims := &handlers.Claims{UserID: deptAdmin.ID, Role: models.DepartmentAdmin, FacilityID: facilityA.ID}
	facClaims := &handlers.Claims{UserID: facAdmin.ID, Role: models.FacilityAdmin, FacilityID: facilityA.ID}
	visibilityURL := fmt.Sprintf("/api/libraries/%d/facilities", libraryID)

	statusFor := func(rows []contentFacilityVisibility, facilityID uint) bool {
		for _, row := range rows {
			if row.FacilityID == facilityID {
				return row.VisibilityStatus
			}
		}
		t.Fatalf("facility %d not found in response", facilityID)
		return false
	}

	t.Run("new library is hidden at all facilities", func(t *testing.T) {
		rows := NewRequest[[]contentFacilityVisibility](env.Client, t, http.MethodGet, visibilityURL, nil).
			WithTestClaims(deptClaims).Do().
			ExpectStatus(http.StatusOK).GetData()
		require.GreaterOrEqual(t, len(rows), 3)
		for _, row := range rows {
			require.False(t, row.VisibilityStatus)
		}
	})

	t.Run("dept admin sets visibility for a subset of facilities", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodPut, visibilityURL, map[string]any{
			"facility_ids":      []uint{facilityA.ID, facilityB.ID},
			"visibility_status": true,
		}).WithTestClaims(deptClaims).Do().ExpectStatus(http.StatusOK)

		rows := NewRequest[[]contentFacilityVisibility](env.Client, t, http.MethodGet, visibilityURL, nil).
			WithTestClaims(deptClaims).Do().
			ExpectStatus(http.StatusOK).GetData()
		require.True(t, statusFor(rows, facilityA.ID))
		require.True(t, statusFor(rows, facilityB.ID))
		require.False(t, statusFor(rows, facilityC.ID))
	})

	t.Run("library list includes visible facility count", func(t *testing.T) {
		libs := NewRequest[[]contentListItem](env.Client, t, http.MethodGet,
			"/api/libraries?visibility=all", nil).
			WithTestClaims(deptClaims).Do().
			ExpectStatus(http.StatusOK).GetData()
		require.Len(t, libs, 1)
		require.Equal(t, 2, libs[0].VisibleFacilityCount)
	})

	t.Run("dept admin hides at all facilities", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodPut, visibilityURL, map[string]any{
			"facility_ids":      []uint{facilityA.ID, facilityB.ID, facilityC.ID},
			"visibility_status": false,
		}).WithTestClaims(deptClaims).Do().ExpectStatus(http.StatusOK)

		rows := NewRequest[[]contentFacilityVisibility](env.Client, t, http.MethodGet, visibilityURL, nil).
			WithTestClaims(deptClaims).Do().
			ExpectStatus(http.StatusOK).GetData()
		for _, row := range rows {
			require.False(t, row.VisibilityStatus)
		}
	})

	t.Run("duplicate facility_ids are handled", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodPut, visibilityURL, map[string]any{
			"facility_ids":      []uint{facilityA.ID, facilityA.ID},
			"visibility_status": true,
		}).WithTestClaims(deptClaims).Do().ExpectStatus(http.StatusOK)

		rows := NewRequest[[]contentFacilityVisibility](env.Client, t, http.MethodGet, visibilityURL, nil).
			WithTestClaims(deptClaims).Do().
			ExpectStatus(http.StatusOK).GetData()
		require.True(t, statusFor(rows, facilityA.ID))

		NewRequest[any](env.Client, t, http.MethodPut, visibilityURL, map[string]any{
			"facility_ids":      []uint{facilityA.ID},
			"visibility_status": false,
		}).WithTestClaims(deptClaims).Do().ExpectStatus(http.StatusOK)
	})

	t.Run("empty facility_ids is rejected", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodPut, visibilityURL, map[string]any{
			"facility_ids":      []uint{},
			"visibility_status": true,
		}).WithTestClaims(deptClaims).Do().ExpectStatus(http.StatusBadRequest)
	})

	t.Run("facility admin cannot access facility visibility endpoints", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodGet, visibilityURL, nil).
			WithTestClaims(facClaims).Do().ExpectStatus(http.StatusUnauthorized)
		NewRequest[any](env.Client, t, http.MethodPut, visibilityURL, map[string]any{
			"facility_ids":      []uint{facilityA.ID},
			"visibility_status": true,
		}).WithTestClaims(facClaims).Do().ExpectStatus(http.StatusUnauthorized)
	})

	t.Run("facility admin toggle still works for own facility", func(t *testing.T) {
		NewRequest[any](env.Client, t, http.MethodPut,
			fmt.Sprintf("/api/libraries/%d/toggle", libraryID), map[string]any{}).
			WithTestClaims(facClaims).Do().ExpectStatus(http.StatusOK)

		rows := NewRequest[[]contentFacilityVisibility](env.Client, t, http.MethodGet, visibilityURL, nil).
			WithTestClaims(deptClaims).Do().
			ExpectStatus(http.StatusOK).GetData()
		require.True(t, statusFor(rows, facilityA.ID))
		require.False(t, statusFor(rows, facilityB.ID))
	})
}

// The JSON shapes of Open Content's responses that these tests read. Tests
// outside the module can't use its Go types (EN-192).
type contentFacilityVisibility struct {
	FacilityID       uint   `json:"facility_id"`
	FacilityName     string `json:"facility_name"`
	VisibilityStatus bool   `json:"visibility_status"`
}

type contentListItem struct {
	ID                   uint `json:"id"`
	VisibilityStatus     bool `json:"visibility_status"`
	VisibleFacilityCount int  `json:"visible_facility_count"`
}
