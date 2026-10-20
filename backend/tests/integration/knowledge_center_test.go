package integration

import (
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/UnlockedLabs/unlocked-core/backend/src/handlers"
	"github.com/UnlockedLabs/unlocked-core/backend/src/models"
	ocapi "github.com/UnlockedLabs/unlocked-core/backend/src/modules/opencontent/api"

	"github.com/stretchr/testify/require"
)

func TestKnowledgeCenterMetrics(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("KC Facility")
	require.NoError(t, err)

	kiwixID := env.InsertReturningID(t, `INSERT INTO open_content_providers (title, url, currently_enabled) VALUES ('Kiwix', 'http://kiwix', false)`)
	youtubeID := env.InsertReturningID(t, `INSERT INTO open_content_providers (title, url, currently_enabled) VALUES ('YouTube', 'http://youtube', false)`)

	careerLibID := env.InsertReturningID(t, `INSERT INTO libraries (open_content_provider_id, title, url) VALUES (?, 'Career Library', '/career')`, kiwixID)
	recoveryLibID := env.InsertReturningID(t, `INSERT INTO libraries (open_content_provider_id, title, url) VALUES (?, 'Recovery Library', '/recovery')`, kiwixID)
	weldingVideoID := env.InsertReturningID(t, `INSERT INTO videos (open_content_provider_id, title, url, external_id) VALUES (?, 'Welding Basics', '/welding', 'vid1')`, youtubeID)

	vocationalID := env.InsertReturningID(t, `INSERT INTO tags (name) VALUES ('Vocational')`)
	lifeSkillsID := env.InsertReturningID(t, `INSERT INTO tags (name) VALUES ('Life Skills')`)
	for _, tag := range [][2]uint{{vocationalID, careerLibID}, {lifeSkillsID, recoveryLibID}} {
		require.NoError(t, env.DB.Exec(`INSERT INTO open_content_tags (tag_id, content_id, open_content_provider_id) VALUES (?, ?, ?)`,
			tag[0], tag[1], kiwixID).Error)
	}

	u1, err := env.CreateTestUser("userone", models.Student, facility.ID, "")
	require.NoError(t, err)
	u2, err := env.CreateTestUser("usertwo", models.Student, facility.ID, "")
	require.NoError(t, err)
	u3, err := env.CreateTestUser("userthree", models.Student, facility.ID, "")
	require.NoError(t, err)

	day := func(hour, min int) time.Time {
		return time.Date(2026, 1, 15, hour, min, 0, 0, time.UTC)
	}
	// prior window for [01-15, 01-17) is [01-13, 01-15); seed on 01-14
	priorDay := func(hour, min int) time.Time {
		return time.Date(2026, 1, 14, hour, min, 0, 0, time.UTC)
	}
	type activity struct {
		userID, providerID, contentID uint
		requestTS, stopTS             time.Time
	}
	activities := []activity{
		// U1: career library twice + one video (3 interactions)
		{u1.ID, kiwixID, careerLibID, day(9, 0), day(9, 10)},
		{u1.ID, kiwixID, careerLibID, day(14, 0), day(14, 5)},
		{u1.ID, youtubeID, weldingVideoID, day(16, 0), day(16, 10)},
		// U2: recovery library once
		{u2.ID, kiwixID, recoveryLibID, day(10, 0), day(10, 20)},
		// U3: video once
		{u3.ID, youtubeID, weldingVideoID, day(11, 0), day(11, 30)},
		// PRIOR window (01-14): career x1, video x3 -> prior total 4 (recovery has none)
		{u1.ID, kiwixID, careerLibID, priorDay(9, 0), priorDay(9, 5)},
		{u1.ID, youtubeID, weldingVideoID, priorDay(9, 0), priorDay(9, 5)},
		{u2.ID, youtubeID, weldingVideoID, priorDay(10, 0), priorDay(10, 5)},
		{u3.ID, youtubeID, weldingVideoID, priorDay(11, 0), priorDay(11, 5)},
	}
	for _, a := range activities {
		require.NoError(t, env.DB.Exec(`INSERT INTO open_content_activities
			(facility_id, user_id, open_content_provider_id, content_id, open_content_url_id, request_ts, stop_ts)
			VALUES (?, ?, ?, ?, 1, ?, ?)`, facility.ID, a.userID, a.providerID, a.contentID, a.requestTS, a.stopTS).Error)
	}

	metrics := NewRequest[models.KnowledgeCenterMetrics](env.Client, t, http.MethodGet,
		"/api/department-metrics/knowledge-center?facility="+strconv.Itoa(int(facility.ID))+
			"&start_date=2026-01-15&end_date=2026-01-16", nil).
		WithTestClaims(&handlers.Claims{Role: models.FacilityAdmin, FacilityID: facility.ID}).
		Do().
		ExpectStatus(http.StatusOK).
		GetData()

	require.Equal(t, int64(5), metrics.TotalInteractions)
	// prior window total = 4 -> change = (5-4)/4 = 25%
	require.Equal(t, 25, metrics.TotalInteractionsChange)
	require.Equal(t, int64(3), metrics.UniqueResidents)
	// durations (min): 10, 5, 10, 20, 30 -> avg 15
	require.InDelta(t, 15.0, metrics.AvgSessionMinutes, 0.01)
	// interaction counts per resident: u1=3 (2-4), u2=1 (once), u3=1 (once)
	require.Equal(t, ocapi.RepeatEngagement{Once: 2, TwoToFour: 1, FivePlus: 0}, metrics.RepeatEngagement)
	require.Equal(t, []ocapi.CategoryViews{
		{Category: "Vocational", Views: 2},
		{Category: "Life Skills", Views: 1},
	}, metrics.LibraryViewsByCategory)
	// career prior 1 -> +100%; recovery prior 0 -> 0%
	require.Equal(t, []ocapi.ContentVisits{
		{Title: "Career Library", Visits: 2, Change: 100},
		{Title: "Recovery Library", Visits: 1, Change: 0},
	}, metrics.TopLibraries)
	// welding prior 3 -> (2-3)/3 = -33%
	require.Equal(t, []ocapi.ContentVisits{
		{Title: "Welding Basics", Visits: 2, Change: -33},
	}, metrics.TopVideos)
}
