package integration

import (
	"UnlockEdv2/src/handlers"
	"UnlockEdv2/src/models"
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestDepartmentLoginTrend(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Trend Facility")
	require.NoError(t, err)

	rows := []models.LoginActivity{
		{TimeInterval: time.Date(2026, 1, 15, 9, 0, 0, 0, time.UTC), FacilityID: facility.ID, TotalLogins: 5},
		{TimeInterval: time.Date(2026, 1, 15, 14, 0, 0, 0, time.UTC), FacilityID: facility.ID, TotalLogins: 7},
		{TimeInterval: time.Date(2026, 1, 16, 10, 0, 0, 0, time.UTC), FacilityID: facility.ID, TotalLogins: 3},
	}
	for i := range rows {
		require.NoError(t, env.DB.Create(&rows[i]).Error)
	}

	endpoint := "/api/department-metrics/login-trend?facility=" +
		strconv.Itoa(int(facility.ID)) + "&start_date=2026-01-15&end_date=2026-01-16"

	resp := NewRequest[[]models.DailyLoginCount](env.Client, t, http.MethodGet, endpoint, nil).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	require.Equal(t, []models.DailyLoginCount{
		{Date: "2026-01-15", TotalLogins: 12},
		{Date: "2026-01-16", TotalLogins: 3},
	}, resp.GetData())
}

func TestDepartmentLoginTrend_AllFacilitiesAggregates(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facilityA, err := env.CreateTestFacility("Facility A")
	require.NoError(t, err)
	facilityB, err := env.CreateTestFacility("Facility B")
	require.NoError(t, err)

	rows := []models.LoginActivity{
		{TimeInterval: time.Date(2026, 1, 15, 9, 0, 0, 0, time.UTC), FacilityID: facilityA.ID, TotalLogins: 5},
		{TimeInterval: time.Date(2026, 1, 15, 11, 0, 0, 0, time.UTC), FacilityID: facilityB.ID, TotalLogins: 4},
		{TimeInterval: time.Date(2026, 1, 16, 10, 0, 0, 0, time.UTC), FacilityID: facilityB.ID, TotalLogins: 3},
	}
	for i := range rows {
		require.NoError(t, env.DB.Create(&rows[i]).Error)
	}

	resp := NewRequest[[]models.DailyLoginCount](env.Client, t, http.MethodGet,
		"/api/department-metrics/login-trend?facility=all&start_date=2026-01-15&end_date=2026-01-16", nil).
		WithTestClaims(&handlers.Claims{Role: models.SystemAdmin, FacilityID: facilityA.ID}).
		Do().
		ExpectStatus(http.StatusOK)

	require.Equal(t, []models.DailyLoginCount{
		{Date: "2026-01-15", TotalLogins: 9},
		{Date: "2026-01-16", TotalLogins: 3},
	}, resp.GetData())
}
