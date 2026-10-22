package integration

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/UnlockedLabs/unlocked-core/backend/src/handlers"
	"github.com/UnlockedLabs/unlocked-core/backend/src/models"

	"github.com/stretchr/testify/require"
)

// These tests pin what every Open Content route answers (EN-192): the status
// and the JSON, and who may call it. They seed with SQL and read raw JSON, so
// they don't depend on the Go types that move into the Open Content module,
// and they must pass unchanged after the move.
//
// Regenerate the golden files after an intended change with:
//
//	go test ./tests/integration -run 'TestOpenContent' -update

var updateGolden = flag.Bool("update", false, "rewrite the golden files in testdata")

type openContentWorld struct {
	north, south                  *models.Facility
	resident, facAdmin, deptAdmin *models.User
}

func (w openContentWorld) claims(u *models.User) *handlers.Claims {
	return &handlers.Claims{UserID: u.ID, Username: u.Username, Role: u.Role, FacilityID: w.north.ID, FacilityName: w.north.Name}
}

// seedOpenContent adds two libraries, two videos and a helpful link at the
// North facility, plus a favorite and some reading activity for the resident.
// SeedDefaultData has already added providers 1 (Kiwix) and 2 (YouTube) and
// two helpful links. Production's migrations also add a HelpfulLinks provider
// and the links point to it, so the seed does the same here.
func seedOpenContent(t *testing.T, env *TestEnv) openContentWorld {
	t.Helper()
	var w openContentWorld
	var err error
	w.north, err = env.CreateTestFacility("North")
	require.NoError(t, err)
	w.south, err = env.CreateTestFacility("South")
	require.NoError(t, err)
	w.resident, err = env.CreateTestUser("jdoe", models.Student, w.north.ID, "1001")
	require.NoError(t, err)
	w.facAdmin, err = env.CreateTestUser("facadmin", models.FacilityAdmin, w.north.ID, "")
	require.NoError(t, err)
	w.deptAdmin, err = env.CreateTestUser("deptadmin", models.DepartmentAdmin, w.north.ID, "")
	require.NoError(t, err)

	// Fixed times keep the ordering stable; recent ones fall inside the
	// activity routes' default two-week window.
	day := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	recent := time.Now().UTC().Add(-48 * time.Hour).Truncate(time.Second)
	for _, stmt := range []struct {
		sql  string
		args []any
	}{
		{`INSERT INTO open_content_providers (id, title, url, thumbnail_url, currently_enabled, description, created_at, updated_at)
			VALUES (3, 'HelpfulLinks', 'https://helpful.example', '/ul-logo-d.svg', true, 'Hand picked helpful links for users', ?, ?)`, []any{day, day}},
		{`UPDATE helpful_links SET open_content_provider_id = 3 WHERE open_content_provider_id = 1`, nil},
		{`UPDATE facility_visibility_statuses SET open_content_provider_id = 3 WHERE open_content_provider_id = 1`, nil},
		{`INSERT INTO libraries (id, open_content_provider_id, external_id, title, language, description, url, thumbnail_url, created_at, updated_at) VALUES
			(1, 1, 'lib-algebra', 'Algebra', 'fra', 'Algebre pour tous', '/content/algebra_fr', '/thumbs/algebra.png', ?, ?),
			(2, 1, 'lib-biology', 'Biology', 'spa', 'Biologia', '/content/biology_es', NULL, ?, ?)`,
			[]any{day, day, day.Add(time.Hour), day.Add(time.Hour)}},
		{`INSERT INTO tags (id, name) VALUES (1, 'Science')`, nil},
		{`INSERT INTO open_content_tags (tag_id, content_id, open_content_provider_id) VALUES (1, 2, 1)`, nil},
		{`INSERT INTO videos (id, external_id, url, title, availability, channel_title, duration, description, thumbnail_url, open_content_provider_id, created_at, updated_at) VALUES
			(1, 'vid-ok', 'https://www.youtube.com/watch?v=vid-ok', 'Intro Video', 'available', 'Channel A', 120, 'An intro', '/thumbs/v1.jpg', 2, ?, ?),
			(2, 'vid-error', 'https://www.youtube.com/watch?v=vid-error', 'Broken Video', 'has_error', 'Channel B', 60, NULL, NULL, 2, ?, ?)`,
			[]any{day, day, day.Add(time.Hour), day.Add(time.Hour)}},
		{`INSERT INTO video_download_attempts (video_id, error_message, created_at, updated_at) VALUES
			(2, 'timeout', ?, ?), (2, 'timeout', ?, ?), (2, 'timeout', ?, ?), (2, 'timeout', ?, ?), (2, 'timeout', ?, ?)`,
			[]any{day, day, day, day, day, day, day, day, day, day}},
		{`INSERT INTO helpful_links (id, title, description, url, open_content_provider_id, thumbnail_url, created_at, updated_at)
			VALUES (3, 'Khan Academy', 'Free courses', 'https://www.khanacademy.org', 3, '/thumbs/khan.png', ?, ?)`, []any{day, day}},
		{`INSERT INTO facility_visibility_statuses (facility_id, open_content_provider_id, content_id, visibility_status) VALUES
			(?, 1, 1, true), (?, 2, 1, true), (?, 3, 3, true)`, []any{w.north.ID, w.north.ID, w.north.ID}},
		{`INSERT INTO open_content_favorites (user_id, content_id, open_content_provider_id, created_at) VALUES (?, 1, 1, ?)`,
			[]any{w.resident.ID, day}},
		{`INSERT INTO open_content_urls (id, content_url) VALUES (1, '/api/proxy/libraries/1/content/algebra_fr/A/Lesson_1'), (2, '/viewer/videos/1')`, nil},
		{`INSERT INTO open_content_activities (open_content_provider_id, facility_id, user_id, content_id, open_content_url_id, request_ts, stop_ts) VALUES
			(1, ?, ?, 1, 1, ?, ?), (1, ?, ?, 1, 1, ?, ?), (2, ?, ?, 1, 2, ?, ?)`,
			[]any{
				w.north.ID, w.resident.ID, recent, recent.Add(10 * time.Minute),
				w.north.ID, w.resident.ID, recent.Add(time.Hour), recent.Add(70 * time.Minute),
				w.north.ID, w.resident.ID, recent.Add(2 * time.Hour), recent.Add(122 * time.Minute),
			}},
	} {
		require.NoError(t, env.DB.Exec(stmt.sql, stmt.args...).Error, stmt.sql)
	}
	return w
}

// noRedirects is env's client without following redirects, so a test sees
// the redirect a route answers with.
func noRedirects(env *TestEnv) *Client {
	return &Client{baseURL: env.Client.baseURL, httpClient: &http.Client{
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}}
}

func TestOpenContentRoutes(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()
	w := seedOpenContent(t, env)
	client := noRedirects(env)

	resident, facAdmin, deptAdmin := w.claims(w.resident), w.claims(w.facAdmin), w.claims(w.deptAdmin)
	// The helpful-links sort order is kept in memory per facility, so it
	// outlives this test's database. Clear it for the next run.
	defer func() {
		NewRequest[any](client, t, http.MethodPut, "/api/helpful-links/sort", map[string]any{"sort_order": ""}).
			WithTestClaims(facAdmin).Do().ExpectStatus(http.StatusOK)
	}()
	visibilityBody := map[string]any{"facility_ids": []uint{w.north.ID, w.south.ID}, "visibility_status": true}

	// The cases run in order against one database, so later reads show the
	// earlier writes.
	tests := []struct {
		name   string
		claims *handlers.Claims
		method string
		path   string
		body   any
		status int
	}{
		// Libraries
		{"libraries_resident", resident, http.MethodGet, "/api/libraries", nil, http.StatusOK},
		{"libraries_admin_all", facAdmin, http.MethodGet, "/api/libraries?visibility=all", nil, http.StatusOK},
		{"libraries_admin_hidden", facAdmin, http.MethodGet, "/api/libraries?visibility=hidden", nil, http.StatusOK},
		{"libraries_resident_hidden", resident, http.MethodGet, "/api/libraries?visibility=hidden", nil, http.StatusUnauthorized},
		{"libraries_resident_featured", resident, http.MethodGet, "/api/libraries?visibility=featured", nil, http.StatusOK},
		{"libraries_admin_search_and_tag", facAdmin, http.MethodGet, "/api/libraries?visibility=all&search=bio&tags=1", nil, http.StatusOK},
		{"libraries_admin_paged", facAdmin, http.MethodGet, "/api/libraries?visibility=all&page=2&per_page=1&order_by=title", nil, http.StatusOK},
		{"library_by_id", resident, http.MethodGet, "/api/libraries/1", nil, http.StatusOK},
		{"library_by_id_bad_id", resident, http.MethodGet, "/api/libraries/abc", nil, http.StatusBadRequest},
		{"library_by_id_missing", resident, http.MethodGet, "/api/libraries/999", nil, http.StatusBadRequest},
		{"tags", resident, http.MethodGet, "/api/tags", nil, http.StatusOK},
		// The library proxy's own checks. A visible library would go on to
		// Kiwix, which the tests don't run.
		{"proxy_library_missing", resident, http.MethodGet, "/api/proxy/libraries/999/", nil, http.StatusNotFound},
		{"proxy_library_hidden", resident, http.MethodGet, "/api/proxy/libraries/2/", nil, http.StatusNotFound},
		{"library_favorite_toggle", resident, http.MethodPut, "/api/libraries/2/favorite", map[string]any{}, http.StatusOK},
		{"library_feature_toggle", facAdmin, http.MethodPut, "/api/libraries/1/favorite", map[string]any{}, http.StatusOK},
		{"library_visibility_toggle", facAdmin, http.MethodPut, "/api/libraries/2/toggle", map[string]any{}, http.StatusOK},
		{"libraries_resident_after_toggles", resident, http.MethodGet, "/api/libraries", nil, http.StatusOK},
		{"library_facilities", deptAdmin, http.MethodGet, "/api/libraries/1/facilities", nil, http.StatusOK},
		{"library_facilities_set", deptAdmin, http.MethodPut, "/api/libraries/1/facilities", visibilityBody, http.StatusOK},
		{"library_facilities_set_empty", deptAdmin, http.MethodPut, "/api/libraries/1/facilities", map[string]any{"facility_ids": []uint{}}, http.StatusBadRequest},
		{"library_facilities_after_set", deptAdmin, http.MethodGet, "/api/libraries/1/facilities", nil, http.StatusOK},

		// Search. The title search is Postgres full-text search and the
		// Kiwix search needs Kiwix, so on SQLite this pins only the shape of
		// an empty result. make dev covers a real search.
		{"search_empty", resident, http.MethodGet, "/api/open-content/search?search=algebra", nil, http.StatusOK},
		{"suggestions_no_query", resident, http.MethodGet, "/api/open-content/suggestions", nil, http.StatusBadRequest},

		// Open content
		{"providers", resident, http.MethodGet, "/api/open-content", nil, http.StatusOK},
		{"providers_admin_all", facAdmin, http.MethodGet, "/api/open-content?all=true", nil, http.StatusOK},
		{"bookmark", resident, http.MethodPut, "/api/open-content/1/bookmark",
			map[string]any{"name": "Lesson 1", "content_url": "/api/proxy/libraries/1/content/algebra_fr/A/Lesson_1", "open_content_provider_id": 1}, http.StatusOK},
		{"bookmark_bad_id", resident, http.MethodPut, "/api/open-content/abc/bookmark", map[string]any{}, http.StatusBadRequest},
		{"favorites", resident, http.MethodGet, "/api/open-content/favorites", nil, http.StatusOK},
		{"favorite_groupings", resident, http.MethodGet, "/api/open-content/favorite-groupings", nil, http.StatusOK},
		{"request_content_bad_body", resident, http.MethodPost, "/api/open-content/request-content", "not an object", http.StatusBadRequest},

		// Activity
		{"activity_facility", facAdmin, http.MethodGet, "/api/open-content/activity", nil, http.StatusOK},
		{"activity_user", facAdmin, http.MethodGet, fmt.Sprintf("/api/open-content/activity/%d", w.resident.ID), nil, http.StatusOK},
		{"activity_user_bad_id", facAdmin, http.MethodGet, "/api/open-content/activity/abc", nil, http.StatusBadRequest},
		{"activity_libraries", facAdmin, http.MethodGet, "/api/libraries/activity", nil, http.StatusOK},

		// Videos
		{"videos_resident", resident, http.MethodGet, "/api/videos", nil, http.StatusOK},
		{"videos_admin_all", facAdmin, http.MethodGet, "/api/videos?visibility=all", nil, http.StatusOK},
		// The video proxy, with no S3 bucket, redirects to the local file.
		{"proxy_video", resident, http.MethodGet, "/api/proxy/videos/1", nil, http.StatusTemporaryRedirect},
		{"proxy_video_missing", resident, http.MethodGet, "/api/proxy/videos/999", nil, http.StatusNotFound},
		{"video_by_id_admin", facAdmin, http.MethodGet, "/api/videos/1", nil, http.StatusOK},
		// Even an admin can't open a video that isn't available.
		{"video_by_id_admin_not_available", facAdmin, http.MethodGet, "/api/videos/2", nil, http.StatusForbidden},
		{"video_by_id_resident_not_available", resident, http.MethodGet, "/api/videos/2", nil, http.StatusForbidden},
		{"video_by_id_bad_id", resident, http.MethodGet, "/api/videos/abc", nil, http.StatusBadRequest},
		{"video_favorite", resident, http.MethodPut, "/api/videos/1/favorite", map[string]any{}, http.StatusOK},
		{"video_feature", facAdmin, http.MethodPut, "/api/videos/1/feature", map[string]any{}, http.StatusOK},
		{"video_visibility_toggle", facAdmin, http.MethodPut, "/api/videos/1/visibility", map[string]any{}, http.StatusOK},
		{"video_retry_max_attempts", facAdmin, http.MethodPut, "/api/videos/2/retry", map[string]any{}, http.StatusBadRequest},
		{"video_action_unknown", facAdmin, http.MethodPut, "/api/videos/1/unknown", map[string]any{}, http.StatusBadRequest},
		{"video_action_missing", facAdmin, http.MethodPut, "/api/videos/999/feature", map[string]any{}, http.StatusBadRequest},
		{"videos_resident_after_toggle", resident, http.MethodGet, "/api/videos", nil, http.StatusOK},
		{"videos_add_none", facAdmin, http.MethodPost, "/api/videos", map[string]any{"video_urls": []string{}}, http.StatusBadRequest},
		{"videos_add_bad_url", facAdmin, http.MethodPost, "/api/videos", map[string]any{"video_urls": []string{"ftp://example.com/v"}}, http.StatusBadRequest},
		{"video_facilities", deptAdmin, http.MethodGet, "/api/videos/1/facilities", nil, http.StatusOK},
		{"video_facilities_set", deptAdmin, http.MethodPut, "/api/videos/1/facilities", visibilityBody, http.StatusOK},
		{"video_facilities_after_set", deptAdmin, http.MethodGet, "/api/videos/1/facilities", nil, http.StatusOK},
		{"video_delete", facAdmin, http.MethodDelete, "/api/videos/2", nil, http.StatusOK},
		{"videos_admin_after_delete", facAdmin, http.MethodGet, "/api/videos?visibility=all", nil, http.StatusOK},

		// Helpful links
		{"links_resident", resident, http.MethodGet, "/api/helpful-links", nil, http.StatusOK},
		{"links_admin", facAdmin, http.MethodGet, "/api/helpful-links", nil, http.StatusOK},
		{"link_add", facAdmin, http.MethodPut, "/api/helpful-links",
			map[string]any{"title": "Library of Congress", "description": "Public records", "url": "https://www.loc.gov"}, http.StatusCreated},
		{"link_edit", facAdmin, http.MethodPatch, "/api/helpful-links/3/edit",
			map[string]any{"title": "Khan Academy", "description": "Free courses and practice", "url": "https://www.khanacademy.org/math"}, http.StatusOK},
		{"link_visibility_toggle", facAdmin, http.MethodPut, "/api/helpful-links/toggle/3", map[string]any{}, http.StatusOK},
		{"link_facilities", deptAdmin, http.MethodGet, "/api/helpful-links/facilities/3", nil, http.StatusOK},
		{"link_facilities_set", deptAdmin, http.MethodPut, "/api/helpful-links/facilities/3", visibilityBody, http.StatusOK},
		{"link_facilities_after_set", deptAdmin, http.MethodGet, "/api/helpful-links/facilities/3", nil, http.StatusOK},
		{"link_activity", resident, http.MethodPut, "/api/helpful-links/activity/3", map[string]any{}, http.StatusOK},
		{"link_activity_missing", resident, http.MethodPut, "/api/helpful-links/activity/999", map[string]any{}, http.StatusBadRequest},
		{"link_favorite", resident, http.MethodPut, "/api/helpful-links/favorite/3", map[string]any{}, http.StatusOK},
		{"links_sort", facAdmin, http.MethodPut, "/api/helpful-links/sort", map[string]any{"sort_order": "title ASC"}, http.StatusOK},
		{"links_admin_after_changes", facAdmin, http.MethodGet, "/api/helpful-links", nil, http.StatusOK},
		{"link_delete", facAdmin, http.MethodDelete, "/api/helpful-links/3", nil, http.StatusOK},
		{"links_resident_after_delete", resident, http.MethodGet, "/api/helpful-links", nil, http.StatusOK},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := NewRequest[any](client, t, tt.method, tt.path, tt.body).
				WithTestClaims(tt.claims).AsRaw().Do().
				ExpectStatus(tt.status)
			expectGolden(t, "open_content", tt.name, resp.rawBody)
		})
	}
}

// TestOpenContentRouteAccess pins each route's access level and feature flags,
// the part of a route most easily lost in a move.
func TestOpenContentRouteAccess(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()
	w := seedOpenContent(t, env)
	client := noRedirects(env)

	const (
		anyUser = iota
		admin
		deptAdmin
	)
	routes := []struct {
		method, path string
		access       int
		features     []models.FeatureAccess
	}{
		{http.MethodGet, "/api/libraries", anyUser, []models.FeatureAccess{models.OpenContentAccess}},
		{http.MethodGet, "/api/open-content/search", anyUser, []models.FeatureAccess{models.OpenContentAccess}},
		{http.MethodGet, "/api/open-content/suggestions", anyUser, []models.FeatureAccess{models.OpenContentAccess}},
		{http.MethodGet, "/api/libraries/1", anyUser, []models.FeatureAccess{models.OpenContentAccess}},
		{http.MethodPut, "/api/libraries/1/favorite", anyUser, []models.FeatureAccess{models.OpenContentAccess}},
		{http.MethodPut, "/api/libraries/1/toggle", admin, []models.FeatureAccess{models.OpenContentAccess}},
		{http.MethodGet, "/api/libraries/1/facilities", deptAdmin, []models.FeatureAccess{models.OpenContentAccess}},
		{http.MethodPut, "/api/libraries/1/facilities", deptAdmin, []models.FeatureAccess{models.OpenContentAccess}},
		{http.MethodGet, "/api/open-content", anyUser, []models.FeatureAccess{models.OpenContentAccess}},
		{http.MethodGet, "/api/open-content/favorites", anyUser, []models.FeatureAccess{models.OpenContentAccess}},
		{http.MethodPut, "/api/open-content/1/bookmark", anyUser, []models.FeatureAccess{models.OpenContentAccess}},
		{http.MethodGet, "/api/open-content/favorite-groupings", anyUser, []models.FeatureAccess{models.OpenContentAccess}},
		{http.MethodPost, "/api/open-content/request-content", anyUser, []models.FeatureAccess{models.OpenContentAccess, models.RequestContentAccess}},
		{http.MethodGet, "/api/open-content/activity", anyUser, []models.FeatureAccess{models.OpenContentAccess}},
		{http.MethodGet, "/api/open-content/activity/1", anyUser, []models.FeatureAccess{models.OpenContentAccess}},
		{http.MethodGet, "/api/libraries/activity", anyUser, []models.FeatureAccess{models.OpenContentAccess}},
		{http.MethodGet, "/api/videos", anyUser, []models.FeatureAccess{models.UploadVideoAccess}},
		{http.MethodGet, "/api/videos/1", anyUser, []models.FeatureAccess{models.UploadVideoAccess}},
		{http.MethodPut, "/api/videos/1/favorite", anyUser, []models.FeatureAccess{models.UploadVideoAccess}},
		{http.MethodPost, "/api/videos", admin, []models.FeatureAccess{models.UploadVideoAccess}},
		{http.MethodPut, "/api/videos/1/visibility", admin, []models.FeatureAccess{models.UploadVideoAccess}},
		{http.MethodGet, "/api/videos/1/facilities", deptAdmin, []models.FeatureAccess{models.UploadVideoAccess}},
		{http.MethodPut, "/api/videos/1/facilities", deptAdmin, []models.FeatureAccess{models.UploadVideoAccess}},
		{http.MethodDelete, "/api/videos/1", admin, []models.FeatureAccess{models.UploadVideoAccess}},
		{http.MethodGet, "/api/helpful-links", anyUser, []models.FeatureAccess{models.HelpfulLinksAccess}},
		{http.MethodPut, "/api/helpful-links", admin, []models.FeatureAccess{models.HelpfulLinksAccess}},
		{http.MethodPatch, "/api/helpful-links/1/edit", admin, []models.FeatureAccess{models.HelpfulLinksAccess}},
		{http.MethodPut, "/api/helpful-links/toggle/1", admin, []models.FeatureAccess{models.HelpfulLinksAccess}},
		{http.MethodDelete, "/api/helpful-links/1", admin, []models.FeatureAccess{models.HelpfulLinksAccess}},
		{http.MethodGet, "/api/helpful-links/facilities/1", deptAdmin, []models.FeatureAccess{models.HelpfulLinksAccess}},
		{http.MethodPut, "/api/helpful-links/facilities/1", deptAdmin, []models.FeatureAccess{models.HelpfulLinksAccess}},
		{http.MethodPut, "/api/helpful-links/activity/1", anyUser, []models.FeatureAccess{models.HelpfulLinksAccess}},
		{http.MethodPut, "/api/helpful-links/sort", admin, []models.FeatureAccess{models.HelpfulLinksAccess}},
		{http.MethodPut, "/api/helpful-links/favorite/1", anyUser, []models.FeatureAccess{models.HelpfulLinksAccess}},
		{http.MethodGet, "/api/tags", anyUser, nil},
	}

	for _, rt := range routes {
		t.Run(rt.method+" "+rt.path, func(t *testing.T) {
			// A department admin passes every role check, so a 401 here is
			// the feature check. Each required feature must be checked.
			for _, f := range rt.features {
				NewRequest[any](client, t, rt.method, rt.path, map[string]any{}).
					WithTestClaims(withFeatures(w.claims(w.deptAdmin), f)).Do().
					ExpectStatus(http.StatusUnauthorized).ExpectMessage("Feature not enabled")
			}
			switch rt.access {
			case anyUser:
				// A resident gets past every check. The body isn't valid JSON,
				// so a route that reads one stops there without side effects.
				resp := NewRequest[any](client, t, rt.method, rt.path, "not an object").
					WithTestClaims(w.claims(w.resident)).AsRaw().Do()
				require.NotEqual(t, http.StatusUnauthorized, resp.resp.StatusCode, resp.rawBody)
			case admin:
				NewRequest[any](client, t, rt.method, rt.path, map[string]any{}).
					WithTestClaims(w.claims(w.resident)).Do().
					ExpectStatus(http.StatusUnauthorized).ExpectMessage("Unauthorized - not admin")
			case deptAdmin:
				for _, u := range []*models.User{w.resident, w.facAdmin} {
					NewRequest[any](client, t, rt.method, rt.path, map[string]any{}).
						WithTestClaims(w.claims(u)).AsRaw().Do().
						ExpectStatus(http.StatusUnauthorized).
						ExpectRaw("User is not allowed to view this resource\n")
				}
			}
		})
	}

	// The proxies send a user without Open Content back to log in.
	for _, path := range []string{"/api/proxy/libraries/1/", "/api/proxy/videos/1"} {
		t.Run("GET "+path, func(t *testing.T) {
			NewRequest[any](client, t, http.MethodGet, path, nil).
				WithTestClaims(withFeatures(w.claims(w.resident), models.OpenContentAccess)).AsRaw().Do().
				ExpectStatus(http.StatusSeeOther).
				ExpectHeader("Location", handlers.AuthCallbackRoute)
		})
	}
}

// withFeatures returns the claims with every feature on except the ones left
// out.
func withFeatures(c *handlers.Claims, off ...models.FeatureAccess) *handlers.Claims {
	cp := *c
	cp.FeatureAccess = []models.FeatureAccess{}
	for _, f := range models.AllFeatures {
		if !slices.Contains(off, f) {
			cp.FeatureAccess = append(cp.FeatureAccess, f)
		}
	}
	return &cp
}

// timeKey matches the JSON fields that hold a time that changes every run.
var timeKey = regexp.MustCompile(`(_at|_ts)$`)

// expectGolden compares body with testdata/<dir>/<name>.golden. A JSON body is
// compared after indenting it and replacing its times with "<time>".
func expectGolden(t *testing.T, dir, name, body string) {
	t.Helper()
	got := normalizeBody(t, body)
	path := filepath.Join("testdata", dir, name+".golden")
	if *updateGolden {
		require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o755))
		require.NoError(t, os.WriteFile(path, []byte(got), 0o644))
		return
	}
	want, err := os.ReadFile(path)
	require.NoError(t, err, "missing golden file; run with -update to create it")
	require.Equal(t, string(want), got)
}

func normalizeBody(t *testing.T, body string) string {
	t.Helper()
	var v any
	if err := json.Unmarshal([]byte(body), &v); err != nil {
		return body
	}
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)
	require.NoError(t, enc.Encode(maskTimes(v)))
	return buf.String()
}

// maskTimes replaces every time with "<time>", except a zero time, which is
// kept because it shows a field the route never set.
func maskTimes(v any) any {
	switch v := v.(type) {
	case map[string]any:
		for k, x := range v {
			if s, ok := x.(string); ok && timeKey.MatchString(k) && !strings.HasPrefix(s, "0001-01-01") {
				v[k] = "<time>"
			} else {
				v[k] = maskTimes(x)
			}
		}
	case []any:
		for i, x := range v {
			v[i] = maskTimes(x)
		}
	}
	return v
}
