package providerplatforms

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/providerplatforms/api"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func newTestAPI(t *testing.T) (providerPlatformsAPI, *gorm.DB) {
	t.Helper()
	db := openTestDB(t)
	return NewAPI(db).(providerPlatformsAPI), db
}

func TestAPIProviders(t *testing.T) {
	t.Setenv("APP_KEY", "test-app-key")
	a, db := newTestAPI(t)
	ctx := context.Background()
	canvas := &ProviderPlatform{Name: "Canvas", Type: CanvasCloud, BaseUrl: "https://canvas.example", AccountID: "1", AccessKey: "token", State: Enabled}
	require.NoError(t, a.store.createProviderPlatform(ctx, canvas))
	require.NoError(t, db.Create(&ProviderPlatform{Name: "Old", Type: Kolibri, State: Archived}).Error)

	got, err := a.Provider(ctx, canvas.ID)
	require.NoError(t, err)
	assert.Equal(t, api.Provider{ID: canvas.ID, Type: api.CanvasCloud, Name: "Canvas", BaseURL: "https://canvas.example", AccountID: "1", AccessKey: "token"}, got,
		"the access key is stored encrypted and read back decrypted")

	missing, err := a.Provider(ctx, 999)
	require.NoError(t, err)
	assert.Zero(t, missing)

	active, err := a.ActiveProviders(ctx)
	require.NoError(t, err)
	assert.Equal(t, []api.Provider{got}, active)
}

func TestAPIMappings(t *testing.T) {
	a, db := newTestAPI(t)
	ctx := context.Background()
	for _, m := range []ProviderUserMapping{
		{UserID: 1, ProviderPlatformID: 1, ExternalUserID: "a", ExternalUsername: "a"},
		{UserID: 1, ProviderPlatformID: 2, ExternalUserID: "b", ExternalUsername: "b"},
		{UserID: 2, ProviderPlatformID: 1, ExternalUserID: "c", ExternalUsername: "c"},
	} {
		require.NoError(t, db.Create(&m).Error)
	}

	mappings, err := a.UserMappings(ctx, 1)
	require.NoError(t, err)
	assert.Equal(t, []api.Mapping{{ProviderID: 1, ExternalUserID: "a"}, {ProviderID: 2, ExternalUserID: "b"}}, mappings)

	ids, err := a.MappedUserIDs(ctx, 1)
	require.NoError(t, err)
	assert.ElementsMatch(t, []uint{1, 2}, ids)

	require.NoError(t, a.DeleteUserMappings(ctx, 1))
	ids, err = a.MappedUserIDs(ctx, 1)
	require.NoError(t, err)
	assert.Equal(t, []uint{2}, ids)
	mappings, err = a.UserMappings(ctx, 1)
	require.NoError(t, err)
	assert.Empty(t, mappings)

	t.Run("in the caller's transaction", func(t *testing.T) {
		err := db.Transaction(func(tx *gorm.DB) error {
			require.NoError(t, NewAPI(tx).DeleteUserMappings(ctx, 2))
			return assert.AnError
		})
		require.ErrorIs(t, err, assert.AnError)
		ids, err := a.MappedUserIDs(ctx, 1)
		require.NoError(t, err)
		assert.Equal(t, []uint{2}, ids, "the rolled-back delete left the mapping")
	})
}

// The Canvas and Essential Education screens count the residents linked to a
// course's students, leaving out deleted users and mappings.
func TestAPIMappedUsers(t *testing.T) {
	a, db := newTestAPI(t)
	ctx := context.Background()
	docID := "1001"
	users := []user{
		{Username: "north1", NameFirst: "Ann", NameLast: "North", FacilityID: 1, DocID: &docID},
		{Username: "north2", NameFirst: "Bob", NameLast: "North", FacilityID: 1},
		{Username: "south1", NameFirst: "Cal", NameLast: "South", FacilityID: 2},
		{Username: "gone", NameFirst: "Dee", NameLast: "Gone", FacilityID: 1},
	}
	require.NoError(t, db.Create(&users).Error)
	require.NoError(t, db.Delete(&users[3]).Error)
	for i, ext := range []string{"e1", "e2", "e3", "e4"} {
		require.NoError(t, db.Create(&ProviderUserMapping{UserID: users[i].ID, ProviderPlatformID: 1, ExternalUserID: ext, ExternalUsername: ext}).Error)
	}
	unlinked := ProviderUserMapping{UserID: users[1].ID, ProviderPlatformID: 1, ExternalUserID: "e5", ExternalUsername: "e5"}
	require.NoError(t, db.Create(&unlinked).Error)
	require.NoError(t, db.Delete(&unlinked).Error)
	students := []string{"e1", "e2", "e3", "e4", "e5", "not-linked"}

	mapped, err := a.MappedUsers(ctx, 1, students, 0)
	require.NoError(t, err)
	assert.ElementsMatch(t, []api.MappedUser{
		{ExternalUserID: "e1", UserID: users[0].ID, NameFirst: "Ann", NameLast: "North", DocID: "1001"},
		{ExternalUserID: "e2", UserID: users[1].ID, NameFirst: "Bob", NameLast: "North"},
		{ExternalUserID: "e3", UserID: users[2].ID, NameFirst: "Cal", NameLast: "South"},
	}, mapped)

	atNorth, err := a.MappedUsers(ctx, 1, students, 1)
	require.NoError(t, err)
	assert.Len(t, atNorth, 2)

	count, err := a.CountMapped(ctx, 1, students)
	require.NoError(t, err)
	assert.Equal(t, int64(3), count)

	count, err = a.CountMappedAtFacility(ctx, 1, students, 2)
	require.NoError(t, err)
	assert.Equal(t, int64(1), count)

	perFacility, err := a.CountMappedPerFacility(ctx, 1, students)
	require.NoError(t, err)
	assert.Equal(t, map[uint]int64{1: 2, 2: 1}, perFacility)
}

func TestAPILearningStats(t *testing.T) {
	a, db := newTestAPI(t)
	ctx := context.Background()
	users := []user{{Username: "north", FacilityID: 1}, {Username: "south", FacilityID: 2}}
	require.NoError(t, db.Create(&users).Error)
	courses := []Course{{Name: "Algebra", ProviderPlatformID: 1}, {Name: "Biology", ProviderPlatformID: 1}}
	require.NoError(t, db.Create(&courses).Error)
	for _, e := range []UserEnrollment{
		{UserID: users[0].ID, CourseID: courses[0].ID},
		{UserID: users[1].ID, CourseID: courses[0].ID},
		{UserID: users[1].ID, CourseID: courses[1].ID},
	} {
		require.NoError(t, db.Create(&e).Error)
	}
	require.NoError(t, db.Create(&Activity{UserID: users[0].ID, CourseID: courses[0].ID, Type: CourseInteraction, TimeDelta: 7200, ExternalID: "a1"}).Error)
	require.NoError(t, db.Create(&Activity{UserID: users[1].ID, CourseID: courses[0].ID, Type: CourseInteraction, TimeDelta: 3600, ExternalID: "a2"}).Error)
	require.NoError(t, db.Create(&Outcome{UserID: users[0].ID, CourseID: courses[0].ID, Type: Certificate}).Error)

	all, err := a.LearningStats(ctx, nil)
	require.NoError(t, err)
	assert.Equal(t, int64(2), all.TotalCoursesOffered)
	assert.Equal(t, int64(2), all.TotalStudentsEnrolled)
	assert.Equal(t, int64(3), all.TotalHourlyActivity)
	assert.Equal(t, []api.LearningInsight{
		{CourseName: "Algebra", TotalStudentsCompleted: 1, TotalStudentsEnrolled: 2, CompletionRate: 50, ActivityHours: 3},
		{CourseName: "Biology", TotalStudentsCompleted: 0, TotalStudentsEnrolled: 1, CompletionRate: 0, ActivityHours: 0},
	}, all.Insights)

	north := uint(1)
	atNorth, err := a.LearningStats(ctx, &north)
	require.NoError(t, err)
	assert.Equal(t, int64(1), atNorth.TotalCoursesOffered)
	assert.Equal(t, int64(1), atNorth.TotalStudentsEnrolled)
	assert.Equal(t, int64(2), atNorth.TotalHourlyActivity)
}

// The demo seed resets the learning data from the last seed's day and before.
// Seeding itself calls Postgres procedures, so make dev covers it.
func TestAPIDemoReset(t *testing.T) {
	a, db := newTestAPI(t)
	ctx := context.Background()

	_, found, err := a.LastDemoSeed(ctx)
	require.NoError(t, err)
	assert.False(t, found)

	seeded := time.Date(2026, 3, 1, 12, 0, 0, 0, time.UTC)
	later := seeded.AddDate(0, 0, 2)
	for _, act := range []Activity{
		{UserID: 1, CourseID: 1, Type: ContentInteraction, ExternalID: seededActivity, CreatedAt: seeded, UpdatedAt: seeded},
		{UserID: 1, CourseID: 1, Type: ContentInteraction, ExternalID: "kept", CreatedAt: later, UpdatedAt: later},
	} {
		require.NoError(t, db.Create(&act).Error)
	}
	require.NoError(t, db.Create(&UserCourseActivityTotals{UserID: 1, CourseID: 1, LastTS: &seeded}).Error)
	milestone := Milestone{UserID: 1, CourseID: 1, ExternalID: "m1", Type: AssignmentSubmission}
	milestone.CreatedAt = seeded
	require.NoError(t, db.Create(&milestone).Error)
	outcome := Outcome{UserID: 1, CourseID: 1, Type: Certificate}
	outcome.CreatedAt = later
	require.NoError(t, db.Create(&outcome).Error)

	last, found, err := a.LastDemoSeed(ctx)
	require.NoError(t, err)
	require.True(t, found)
	assert.True(t, last.Equal(seeded), last)

	require.NoError(t, a.ResetDemoLearning(ctx, last))
	var activities []Activity
	require.NoError(t, db.Find(&activities).Error)
	require.Len(t, activities, 1)
	assert.Equal(t, "kept", activities[0].ExternalID)
	for table, want := range map[string]int64{"user_course_activity_totals": 0, "milestones": 0, "outcomes": 1} {
		var n int64
		require.NoError(t, db.Table(table).Count(&n).Error)
		assert.Equal(t, want, n, table)
	}
}

// fakeKolibriAndHydra answers Kolibri's signup and Hydra's client creation.
func fakeKolibriAndHydra(t *testing.T) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/public/signup/", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]any{"id": "kolibri-" + body["username"].(string)})
	})
	mux.HandleFunc("POST /admin/clients", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]any{"client_id": "kolibri-client", "client_name": "kolibri", "client_secret": "secret", "scope": DefaultScopes})
	})
	ts := httptest.NewServer(mux)
	t.Cleanup(ts.Close)
	return ts
}

func TestAPIKolibri(t *testing.T) {
	fake := fakeKolibriAndHydra(t)
	t.Setenv("HYDRA_ADMIN_URL", fake.URL)
	ctx := context.Background()
	jdoe := module.User{ID: 7, Username: "jdoe", NameFirst: "John", NameLast: "Doe"}

	t.Run("no KOLIBRI_URL", func(t *testing.T) {
		a, db := newTestAPI(t)
		t.Setenv("KOLIBRI_URL", "")
		require.NoError(t, a.SetupKolibri(ctx))
		var n int64
		require.NoError(t, db.Model(&ProviderPlatform{}).Count(&n).Error)
		assert.Zero(t, n)
		assert.Error(t, a.AddUserToKolibri(ctx, jdoe), "there is no Kolibri provider")
	})

	t.Run("first start", func(t *testing.T) {
		a, db := newTestAPI(t)
		t.Setenv("KOLIBRI_URL", fake.URL)
		t.Setenv("KOLIBRI_USERNAME", "admin")
		t.Setenv("KOLIBRI_PASSWORD", "pass")
		require.NoError(t, a.SetupKolibri(ctx))

		kolibri, err := a.store.findKolibriInstance()
		require.NoError(t, err)
		assert.Equal(t, fake.URL, kolibri.BaseUrl)
		assert.Equal(t, "admin:pass", kolibri.AccessKey)
		assert.Equal(t, Enabled, kolibri.State)
		var clients []OidcClient
		require.NoError(t, db.Find(&clients).Error)
		require.Len(t, clients, 1)
		assert.Equal(t, kolibri.ID, clients[0].ProviderPlatformID)

		// The Kolibri facility is set once Kolibri runs, so skip that lookup.
		require.NoError(t, db.Model(kolibri).Update("account_id", "facility-1").Error)
		require.NoError(t, a.AddUserToKolibri(ctx, jdoe))
		mappings, err := a.UserMappings(ctx, jdoe.ID)
		require.NoError(t, err)
		assert.Equal(t, []api.Mapping{{ProviderID: kolibri.ID, ExternalUserID: "kolibri-jdoe"}}, mappings)

		require.NoError(t, a.SetupKolibri(ctx), "a second start")
		var n int64
		require.NoError(t, db.Model(&ProviderPlatform{}).Count(&n).Error)
		assert.Equal(t, int64(1), n, "a second start reuses the provider")
	})
}
