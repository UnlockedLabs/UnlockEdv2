package integration

import (
	"UnlockEdv2/src/handlers"
	"UnlockEdv2/src/models"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestFacilityEngagementComparison(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facilityA, err := env.CreateTestFacility("Comparison Facility A")
	require.NoError(t, err)
	facilityB, err := env.CreateTestFacility("Comparison Facility B")
	require.NoError(t, err)

	inRange := time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC)

	// Facility A: 2 registered students, 1 active (logged in during range), 10 logins
	a1, err := env.CreateTestUser("aactive", models.Student, facilityA.ID, "")
	require.NoError(t, err)
	_, err = env.CreateTestUser("ainactive", models.Student, facilityA.ID, "")
	require.NoError(t, err)
	require.NoError(t, env.DB.Create(&models.LoginMetrics{UserID: a1.ID, Total: 4, LastLogin: inRange}).Error)
	require.NoError(t, env.DB.Create(&models.LoginActivity{TimeInterval: inRange, FacilityID: facilityA.ID, TotalLogins: 10}).Error)

	// Facility B: 1 registered student, 1 active, 4 logins
	b1, err := env.CreateTestUser("bactive", models.Student, facilityB.ID, "")
	require.NoError(t, err)
	require.NoError(t, env.DB.Create(&models.LoginMetrics{UserID: b1.ID, Total: 2, LastLogin: inRange}).Error)
	require.NoError(t, env.DB.Create(&models.LoginActivity{TimeInterval: inRange, FacilityID: facilityB.ID, TotalLogins: 4}).Error)

	rows := NewRequest[[]models.FacilityEngagement](env.Client, t, http.MethodGet,
		"/api/department-metrics/facility-comparison?start_date=2026-01-15&end_date=2026-01-16", nil).
		WithTestClaims(&handlers.Claims{Role: models.SystemAdmin, FacilityID: facilityA.ID}).
		Do().
		ExpectStatus(http.StatusOK).
		GetData()

	byID := make(map[uint]models.FacilityEngagement, len(rows))
	for _, row := range rows {
		byID[row.FacilityID] = row
	}

	require.Equal(t, models.FacilityEngagement{
		FacilityID: facilityA.ID, FacilityName: "Comparison Facility A",
		Registered: 2, Active: 1, Logins: 10,
	}, byID[facilityA.ID])
	require.Equal(t, models.FacilityEngagement{
		FacilityID: facilityB.ID, FacilityName: "Comparison Facility B",
		Registered: 1, Active: 1, Logins: 4,
	}, byID[facilityB.ID])
}

func TestFacilityEngagementComparison_ForbiddenForFacilityAdmin(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Solo Facility")
	require.NoError(t, err)

	NewRequest[[]models.FacilityEngagement](env.Client, t, http.MethodGet,
		"/api/department-metrics/facility-comparison?start_date=2026-01-15&end_date=2026-01-16", nil).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusUnauthorized)
}
