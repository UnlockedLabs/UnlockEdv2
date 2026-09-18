package handlers

import (
	"UnlockEdv2/src/models"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// These tests pin down the behavior of the live provider path before it is
// generalized to support a second provider. The synthetic ID arithmetic is the
// part that guarantees two providers never collide, so it is covered first.

func TestEncodeDecodeCanvasClassID(t *testing.T) {
	tests := []struct {
		name        string
		providerID  uint
		rawCourseID uint
	}{
		{"first provider, first course", 1, 1},
		{"provider zero", 0, 42},
		{"max course id", 1, 999_999},
		{"max provider id", 999, 999_999},
		{"typical canvas course", 2, 105},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encoded := encodeCanvasClassID(tt.providerID, tt.rawCourseID)
			assert.GreaterOrEqual(t, encoded, models.CanvasClassIDOffset,
				"encoded id must clear the offset so the dispatch guards fire")
			provider, course := decodeCanvasClassID(encoded)
			assert.Equal(t, tt.providerID, provider)
			assert.Equal(t, tt.rawCourseID, course)
		})
	}
}

// Two providers must never produce the same class ID for different courses.
// This is what lets a second provider reuse the existing offsets untouched.
func TestCanvasClassIDsDoNotCollideAcrossProviders(t *testing.T) {
	seen := map[uint]string{}
	for providerID := uint(1); providerID <= 3; providerID++ {
		for _, rawCourseID := range []uint{1, 2, 105, 999_999} {
			id := encodeCanvasClassID(providerID, rawCourseID)
			key := fmt.Sprintf("provider=%d course=%d", providerID, rawCourseID)
			if prev, dup := seen[id]; dup {
				t.Fatalf("class id %d produced by both %q and %q", id, prev, key)
			}
			seen[id] = key
		}
	}
}

func TestEncodeDecodeFacilityCanvasClassID(t *testing.T) {
	tests := []struct {
		name        string
		facilityID  uint
		providerID  uint
		rawCourseID uint
	}{
		{"typical", 1, 1, 105},
		{"zero facility", 0, 2, 7},
		{"max values", 999, 999, 999_999},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encoded := encodeFacilityCanvasClassID(tt.facilityID, tt.providerID, tt.rawCourseID)
			assert.GreaterOrEqual(t, encoded, models.CanvasFacilityClassIDOffset)
			assert.GreaterOrEqual(t, encoded, models.CanvasClassIDOffset,
				"facility-scoped ids must still satisfy the plain class guards")
			facility, provider, course := decodeFacilityCanvasClassID(encoded)
			assert.Equal(t, tt.facilityID, facility)
			assert.Equal(t, tt.providerID, provider)
			assert.Equal(t, tt.rawCourseID, course)
		})
	}
}

func TestResolveCanvasClassParts(t *testing.T) {
	t.Run("facility-scoped id returns embedded facility", func(t *testing.T) {
		encoded := encodeFacilityCanvasClassID(3, 2, 105)
		facility, provider, course := resolveCanvasClassParts(encoded)
		assert.Equal(t, uint(3), facility)
		assert.Equal(t, uint(2), provider)
		assert.Equal(t, uint(105), course)
	})

	t.Run("old-style id reports facility 0 so caller falls back to claims", func(t *testing.T) {
		encoded := encodeCanvasClassID(2, 105)
		facility, provider, course := resolveCanvasClassParts(encoded)
		assert.Equal(t, uint(0), facility)
		assert.Equal(t, uint(2), provider)
		assert.Equal(t, uint(105), course)
	})
}

func TestIsCanvasProvider(t *testing.T) {
	tests := []struct {
		providerType models.ProviderPlatformType
		want         bool
	}{
		{models.CanvasOSS, true},
		{models.CanvasCloud, true},
		{models.Kolibri, false},
		{models.Brightspace, false},
		{models.ProviderPlatformType("essential_ed"), false},
	}
	for _, tt := range tests {
		t.Run(string(tt.providerType), func(t *testing.T) {
			got := isCanvasProvider(&models.ProviderPlatform{Type: tt.providerType})
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestParseCanvasCourse(t *testing.T) {
	now := time.Date(2026, 9, 15, 0, 0, 0, 0, time.UTC)

	t.Run("full course", func(t *testing.T) {
		entry, ok := parseCanvasCourse(map[string]interface{}{
			"id":          float64(105),
			"name":        "Introduction to Botany",
			"course_code": "BOT101",
			"start_at":    "2026-01-05T00:00:00Z",
			"end_at":      "2026-12-05T00:00:00Z",
		}, 2, now)

		assert.True(t, ok)
		assert.Equal(t, uint(105), entry.rawID)
		assert.Equal(t, encodeCanvasClassID(2, 105), entry.encodedID)
		assert.Equal(t, "Introduction to Botany", entry.name)
		assert.Equal(t, "BOT101", entry.description)
		assert.Equal(t, 2026, entry.startDt.Year())
		assert.NotNil(t, entry.endDt)
		assert.Equal(t, models.Active, entry.status, "end date in the future stays Active")
	})

	t.Run("past end date marks the course Completed", func(t *testing.T) {
		entry, ok := parseCanvasCourse(map[string]interface{}{
			"id":     float64(7),
			"name":   "Old Course",
			"end_at": "2020-01-01T00:00:00Z",
		}, 1, now)

		assert.True(t, ok)
		assert.Equal(t, models.Completed, entry.status)
	})

	t.Run("missing end date stays Active with nil endDt", func(t *testing.T) {
		entry, ok := parseCanvasCourse(map[string]interface{}{
			"id":   float64(7),
			"name": "Ongoing",
		}, 1, now)

		assert.True(t, ok)
		assert.Nil(t, entry.endDt)
		assert.Equal(t, models.Active, entry.status)
	})

	t.Run("non-numeric id is rejected rather than panicking", func(t *testing.T) {
		_, ok := parseCanvasCourse(map[string]interface{}{"id": "105"}, 1, now)
		assert.False(t, ok)
	})

	t.Run("missing id is rejected", func(t *testing.T) {
		_, ok := parseCanvasCourse(map[string]interface{}{"name": "No ID"}, 1, now)
		assert.False(t, ok)
	})

	t.Run("unparseable dates do not fail the course", func(t *testing.T) {
		entry, ok := parseCanvasCourse(map[string]interface{}{
			"id":       float64(9),
			"start_at": "not-a-date",
			"end_at":   "also-not-a-date",
		}, 1, now)

		assert.True(t, ok)
		assert.True(t, entry.startDt.IsZero())
		assert.Nil(t, entry.endDt)
	})
}

func TestBuildCourseTimezoneMap(t *testing.T) {
	got := buildCourseTimezoneMap([]map[string]interface{}{
		{"id": float64(1), "time_zone": "America/Chicago"},
		{"id": float64(2), "time_zone": ""},
		{"id": float64(3)},
		{"name": "no id"},
		{"id": float64(4), "time_zone": "America/New_York"},
	})

	assert.Equal(t, map[uint]string{
		1: "America/Chicago",
		4: "America/New_York",
	}, got, "courses without a usable time_zone are omitted entirely")
}

// fetchAllCanvasPages is the function that gains a pagination seam when a second
// provider is added, so its current contract is pinned here: bearer auth, Link
// header paging, accumulation across pages, and a hard error on non-200.
func TestFetchAllCanvasPages(t *testing.T) {
	t.Run("sends bearer auth and accepts json", func(t *testing.T) {
		var gotAuth, gotAccept string
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			gotAuth = r.Header.Get("Authorization")
			gotAccept = r.Header.Get("Accept")
			_ = json.NewEncoder(w).Encode([]map[string]interface{}{{"id": float64(1)}})
		}))
		defer ts.Close()

		srv := &Server{Client: ts.Client()}
		provider := &models.ProviderPlatform{AccessKey: "secret-token"}

		out, err := srv.fetchAllCanvasPages(context.Background(), provider, ts.URL, 0)
		assert.NoError(t, err)
		assert.Len(t, out, 1)
		assert.Equal(t, "Bearer secret-token", gotAuth)
		assert.Equal(t, "application/json", gotAccept)
	})

	t.Run("follows Link rel=next across pages", func(t *testing.T) {
		var ts *httptest.Server
		calls := 0
		ts = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			calls++
			if calls == 1 {
				w.Header().Set("Link", `<`+ts.URL+`/page2>; rel="next"`)
				_ = json.NewEncoder(w).Encode([]map[string]interface{}{{"id": float64(1)}})
				return
			}
			_ = json.NewEncoder(w).Encode([]map[string]interface{}{{"id": float64(2)}})
		}))
		defer ts.Close()

		srv := &Server{Client: ts.Client()}
		out, err := srv.fetchAllCanvasPages(context.Background(), &models.ProviderPlatform{}, ts.URL, 0)

		assert.NoError(t, err)
		assert.Equal(t, 2, calls)
		assert.Len(t, out, 2, "results from every page are accumulated")
	})

	t.Run("non-200 is an error, not an empty result", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
		}))
		defer ts.Close()

		srv := &Server{Client: ts.Client()}
		out, err := srv.fetchAllCanvasPages(context.Background(), &models.ProviderPlatform{}, ts.URL, 0)

		assert.Error(t, err)
		assert.Nil(t, out)
	})

	t.Run("malformed json is an error", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte(`{"not":"an array"}`))
		}))
		defer ts.Close()

		srv := &Server{Client: ts.Client()}
		_, err := srv.fetchAllCanvasPages(context.Background(), &models.ProviderPlatform{}, ts.URL, 0)

		assert.Error(t, err)
	})

	t.Run("a cancelled context stops the fetch", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_ = json.NewEncoder(w).Encode([]map[string]interface{}{})
		}))
		defer ts.Close()

		ctx, cancel := context.WithCancel(context.Background())
		cancel()

		srv := &Server{Client: ts.Client()}
		_, err := srv.fetchAllCanvasPages(ctx, &models.ProviderPlatform{}, ts.URL, 0)

		assert.Error(t, err)
	})
}

// --- the live-provider seam ---------------------------------------------------

func TestIsLiveProgramProvider(t *testing.T) {
	tests := []struct {
		providerType models.ProviderPlatformType
		want         bool
	}{
		{models.CanvasOSS, true},
		{models.CanvasCloud, true},
		{models.Kolibri, false},
		{models.Brightspace, false},
	}
	for _, tt := range tests {
		t.Run(string(tt.providerType), func(t *testing.T) {
			got := isLiveProgramProvider(&models.ProviderPlatform{Type: tt.providerType})
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestTransportFor(t *testing.T) {
	srv := &Server{}

	t.Run("canvas types get the canvas transport", func(t *testing.T) {
		for _, pt := range []models.ProviderPlatformType{models.CanvasOSS, models.CanvasCloud} {
			transport, err := srv.transportFor(&models.ProviderPlatform{Type: pt})
			assert.NoError(t, err)
			assert.IsType(t, canvasTransport{}, transport)
		}
	})

	t.Run("non-live types are rejected", func(t *testing.T) {
		for _, pt := range []models.ProviderPlatformType{models.Kolibri, models.Brightspace} {
			transport, err := srv.transportFor(&models.ProviderPlatform{Type: pt})
			assert.Error(t, err)
			assert.Nil(t, transport)
		}
	})
}

func TestCanvasURLBuilders(t *testing.T) {
	provider := &models.ProviderPlatform{BaseUrl: "http://canvas", AccountID: "1"}

	assert.Equal(t,
		"http://canvas/api/v1/accounts/1/courses?per_page=100",
		canvasAccountCoursesURL(provider))

	assert.Equal(t,
		"http://canvas/api/v1/courses/105",
		canvasCourseURL(provider, 105))
}

func TestCanvasTransportFetchOne(t *testing.T) {
	t.Run("returns the decoded record and authorizes the request", func(t *testing.T) {
		var gotAuth string
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			gotAuth = r.Header.Get("Authorization")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"id": float64(105), "time_zone": "America/Chicago",
			})
		}))
		defer ts.Close()

		transport := canvasTransport{srv: &Server{Client: ts.Client()}}
		provider := &models.ProviderPlatform{AccessKey: "tok"}

		record, err := transport.fetchOne(context.Background(), provider, ts.URL)
		assert.NoError(t, err)
		assert.Equal(t, "Bearer tok", gotAuth)
		assert.Equal(t, "America/Chicago", record["time_zone"])
	})

	t.Run("non-200 is an error", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNotFound)
		}))
		defer ts.Close()

		transport := canvasTransport{srv: &Server{Client: ts.Client()}}
		record, err := transport.fetchOne(context.Background(), &models.ProviderPlatform{}, ts.URL)
		assert.Error(t, err)
		assert.Nil(t, record)
	})

	t.Run("malformed json is an error", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte(`[not an object]`))
		}))
		defer ts.Close()

		transport := canvasTransport{srv: &Server{Client: ts.Client()}}
		_, err := transport.fetchOne(context.Background(), &models.ProviderPlatform{}, ts.URL)
		assert.Error(t, err)
	})
}

func TestCanvasProviderListCourses(t *testing.T) {
	future := time.Now().AddDate(1, 0, 0).Format("2006-01-02T15:04:05Z")
	past := time.Now().AddDate(-1, 0, 0).Format("2006-01-02T15:04:05Z")

	newReader := func(t *testing.T, payload []map[string]interface{}) (LiveProgramProvider, func()) {
		t.Helper()
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_ = json.NewEncoder(w).Encode(payload)
		}))
		srv := &Server{Client: ts.Client()}
		provider := &models.ProviderPlatform{BaseUrl: ts.URL, AccountID: "1", Type: models.CanvasOSS}
		reader, err := srv.newLiveProgramProvider(provider)
		assert.NoError(t, err)
		return reader, ts.Close
	}

	t.Run("parses courses and collects timezones", func(t *testing.T) {
		reader, done := newReader(t, []map[string]interface{}{
			{"id": float64(1), "name": "Active", "end_at": future, "time_zone": "America/Chicago"},
			{"id": float64(2), "name": "Done", "end_at": past},
		})
		defer done()

		listing, err := reader.ListCourses(context.Background())
		assert.NoError(t, err)
		assert.Len(t, listing.Courses, 2)
		assert.Equal(t, 2, listing.Total)
		assert.Equal(t, models.Active, listing.Courses[0].status)
		assert.Equal(t, models.Completed, listing.Courses[1].status)
		assert.Equal(t, map[uint]string{1: "America/Chicago"}, listing.Timezones)
	})

	// Total counts what the provider returned; Courses counts what we could parse.
	// The overview's class count is reported against Total, so this gap matters.
	t.Run("unparseable records count toward Total but are not returned", func(t *testing.T) {
		reader, done := newReader(t, []map[string]interface{}{
			{"id": float64(1), "name": "Good"},
			{"id": "not-a-number", "name": "Bad"},
		})
		defer done()

		listing, err := reader.ListCourses(context.Background())
		assert.NoError(t, err)
		assert.Len(t, listing.Courses, 1)
		assert.Equal(t, 2, listing.Total)
	})

	t.Run("empty listing is not an error", func(t *testing.T) {
		reader, done := newReader(t, []map[string]interface{}{})
		defer done()

		listing, err := reader.ListCourses(context.Background())
		assert.NoError(t, err)
		assert.Empty(t, listing.Courses)
		assert.Equal(t, 0, listing.Total)
	})

	t.Run("encoded ids are scoped to the provider", func(t *testing.T) {
		reader, done := newReader(t, []map[string]interface{}{{"id": float64(105), "name": "C"}})
		defer done()

		listing, err := reader.ListCourses(context.Background())
		assert.NoError(t, err)
		// The test provider has a zero ID, so this pins the encoding, not the value.
		assert.Equal(t, encodeCanvasClassID(0, 105), listing.Courses[0].encodedID)
	})

	t.Run("a transport error propagates", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
		}))
		defer ts.Close()

		srv := &Server{Client: ts.Client()}
		reader, err := srv.newLiveProgramProvider(
			&models.ProviderPlatform{BaseUrl: ts.URL, AccountID: "1", Type: models.CanvasOSS})
		assert.NoError(t, err)

		_, err = reader.ListCourses(context.Background())
		assert.Error(t, err)
	})
}

func TestNewLiveProgramProviderRejectsNonLiveTypes(t *testing.T) {
	srv := &Server{}
	for _, pt := range []models.ProviderPlatformType{models.Kolibri, models.Brightspace} {
		reader, err := srv.newLiveProgramProvider(&models.ProviderPlatform{Type: pt})
		assert.Error(t, err)
		assert.Nil(t, reader)
	}
}
