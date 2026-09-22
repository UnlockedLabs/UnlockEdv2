package handlers

import (
	"UnlockEdv2/src/models"
	"testing"

	"github.com/stretchr/testify/assert"
)

// The statewide index builds facility-scoped class IDs for every facility, so it
// must not read the entry a single-facility view wrote.
func TestCanvasClassCacheKey(t *testing.T) {
	facility := func(id uint) *uint { return &id }

	tests := []struct {
		name       string
		facilityID *uint
		want       string
	}{
		{"statewide view", nil, "canvas_classes_all"},
		{"a single facility", facility(1), "canvas_classes_1"},
		{"a different facility", facility(2), "canvas_classes_2"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, canvasClassCacheKey(tt.facilityID))
		})
	}
}

// With no NATS bucket the page must still work: no cached classes, and no
// loading state to poll for, so the handler simply returns our own classes.
func TestGetCanvasProviderClassesWithoutBucket(t *testing.T) {
	srv := &Server{}
	classes, loading := srv.getCanvasProviderClasses(nil)
	assert.Nil(t, classes)
	assert.False(t, loading, "without a cache there is nothing to wait for")
}

// A provider that fails a refresh contributes no rows, so without carrying its
// previous rows over its classes would disappear from the page and that absence
// would be cached as a complete listing.
func TestCarryOverFailedProviders(t *testing.T) {
	const (
		healthy = uint(1)
		broken  = uint(2)
	)
	class := func(providerID uint, name string) models.ProgramClassCohort {
		return models.ProgramClassCohort{
			ProgramID: models.CanvasProgramIDOffset + providerID,
			ClassName: name,
		}
	}
	programID := func(c models.ProgramClassCohort) uint { return c.ProgramID }

	tests := []struct {
		name     string
		fresh    []models.ProgramClassCohort
		previous []models.ProgramClassCohort
		failed   []uint
		want     []models.ProgramClassCohort
	}{
		{
			name:     "no failures leaves the fresh listing alone",
			fresh:    []models.ProgramClassCohort{class(healthy, "canvas")},
			previous: []models.ProgramClassCohort{class(healthy, "stale canvas")},
			failed:   nil,
			want:     []models.ProgramClassCohort{class(healthy, "canvas")},
		},
		{
			name:     "one provider down keeps its previous classes",
			fresh:    []models.ProgramClassCohort{class(healthy, "canvas")},
			previous: []models.ProgramClassCohort{class(healthy, "stale canvas"), class(broken, "college prep")},
			failed:   []uint{broken},
			want:     []models.ProgramClassCohort{class(healthy, "canvas"), class(broken, "college prep")},
		},
		{
			name:     "nothing to carry over on a cold cache",
			fresh:    []models.ProgramClassCohort{class(healthy, "canvas")},
			previous: nil,
			failed:   []uint{broken},
			want:     []models.ProgramClassCohort{class(healthy, "canvas")},
		},
		{
			name:     "every provider down with no previous entry yields nothing",
			fresh:    nil,
			previous: nil,
			failed:   []uint{healthy, broken},
			want:     nil,
		},
		{
			name:     "every provider down carries the whole previous listing",
			fresh:    nil,
			previous: []models.ProgramClassCohort{class(healthy, "canvas"), class(broken, "college prep")},
			failed:   []uint{healthy, broken},
			want:     []models.ProgramClassCohort{class(healthy, "canvas"), class(broken, "college prep")},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := carryOverFailedProviders(tt.fresh, tt.previous, tt.failed, programID)
			assert.Equal(t, tt.want, got)
		})
	}
}
