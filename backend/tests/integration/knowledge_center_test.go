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

func TestKnowledgeCenterMetrics(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("KC Facility")
	require.NoError(t, err)

	kiwix := &models.OpenContentProvider{Title: "Kiwix", Url: "http://kiwix"}
	require.NoError(t, env.DB.Create(kiwix).Error)
	youtube := &models.OpenContentProvider{Title: "YouTube", Url: "http://youtube"}
	require.NoError(t, env.DB.Create(youtube).Error)

	careerLib := &models.Library{OpenContentProviderID: kiwix.ID, Title: "Career Library", Url: "/career"}
	require.NoError(t, env.DB.Create(careerLib).Error)
	recoveryLib := &models.Library{OpenContentProviderID: kiwix.ID, Title: "Recovery Library", Url: "/recovery"}
	require.NoError(t, env.DB.Create(recoveryLib).Error)
	weldingVideo := &models.Video{OpenContentProviderID: youtube.ID, Title: "Welding Basics", Url: "/welding", ExternalID: "vid1"}
	require.NoError(t, env.DB.Create(weldingVideo).Error)

	vocational := &models.Tag{Name: "Vocational"}
	require.NoError(t, env.DB.Create(vocational).Error)
	lifeSkills := &models.Tag{Name: "Life Skills"}
	require.NoError(t, env.DB.Create(lifeSkills).Error)
	require.NoError(t, env.DB.Create(&models.OpenContentTag{
		TagID: vocational.ID, ContentID: careerLib.ID, OpenContentProviderID: kiwix.ID,
	}).Error)
	require.NoError(t, env.DB.Create(&models.OpenContentTag{
		TagID: lifeSkills.ID, ContentID: recoveryLib.ID, OpenContentProviderID: kiwix.ID,
	}).Error)

	u1, err := env.CreateTestUser("userone", models.Student, facility.ID, "")
	require.NoError(t, err)
	u2, err := env.CreateTestUser("usertwo", models.Student, facility.ID, "")
	require.NoError(t, err)
	u3, err := env.CreateTestUser("userthree", models.Student, facility.ID, "")
	require.NoError(t, err)

	day := func(hour, min int) time.Time {
		return time.Date(2026, 1, 15, hour, min, 0, 0, time.UTC)
	}
	activities := []models.OpenContentActivity{
		// U1: career library twice + one video (3 interactions)
		{FacilityID: facility.ID, UserID: u1.ID, OpenContentProviderID: kiwix.ID, ContentID: careerLib.ID, OpenContentUrlID: 1, RequestTS: day(9, 0), StopTS: day(9, 10)},
		{FacilityID: facility.ID, UserID: u1.ID, OpenContentProviderID: kiwix.ID, ContentID: careerLib.ID, OpenContentUrlID: 1, RequestTS: day(14, 0), StopTS: day(14, 5)},
		{FacilityID: facility.ID, UserID: u1.ID, OpenContentProviderID: youtube.ID, ContentID: weldingVideo.ID, OpenContentUrlID: 1, RequestTS: day(16, 0), StopTS: day(16, 10)},
		// U2: recovery library once
		{FacilityID: facility.ID, UserID: u2.ID, OpenContentProviderID: kiwix.ID, ContentID: recoveryLib.ID, OpenContentUrlID: 1, RequestTS: day(10, 0), StopTS: day(10, 20)},
		// U3: video once
		{FacilityID: facility.ID, UserID: u3.ID, OpenContentProviderID: youtube.ID, ContentID: weldingVideo.ID, OpenContentUrlID: 1, RequestTS: day(11, 0), StopTS: day(11, 30)},
	}
	for i := range activities {
		require.NoError(t, env.DB.Create(&activities[i]).Error)
	}

	metrics := NewRequest[models.KnowledgeCenterMetrics](env.Client, t, http.MethodGet,
		"/api/department-metrics/knowledge-center?facility="+strconv.Itoa(int(facility.ID))+
			"&start_date=2026-01-15&end_date=2026-01-16", nil).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK).
		GetData()

	require.Equal(t, int64(5), metrics.TotalInteractions)
	require.Equal(t, int64(3), metrics.UniqueResidents)
	// durations (min): 10, 5, 10, 20, 30 -> avg 15
	require.InDelta(t, 15.0, metrics.AvgSessionMinutes, 0.01)
	// interaction counts per resident: u1=3 (2-4), u2=1 (once), u3=1 (once)
	require.Equal(t, models.RepeatEngagement{Once: 2, TwoToFour: 1, FivePlus: 0}, metrics.RepeatEngagement)
	require.Equal(t, []models.CategoryViews{
		{Category: "Vocational", Views: 2},
		{Category: "Life Skills", Views: 1},
	}, metrics.LibraryViewsByCategory)
	require.Equal(t, []models.KCContentRow{
		{Title: "Career Library", Visits: 2},
		{Title: "Recovery Library", Visits: 1},
	}, metrics.TopLibraries)
	require.Equal(t, []models.KCContentRow{
		{Title: "Welding Basics", Visits: 2},
	}, metrics.TopVideos)
}
