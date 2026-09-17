package handlers

import (
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
