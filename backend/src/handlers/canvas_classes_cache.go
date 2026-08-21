package handlers

import (
	"UnlockEdv2/src/models"
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	log "github.com/sirupsen/logrus"
)

// The facility classes index must never block on the Canvas API: listing every
// course for a provider and then fetching each course's enrollments is dozens of
// sequential HTTP round trips. Instead the expensive part is cached in NATS KV
// per provider platform and refreshed by a background goroutine, mirroring the
// approach used for the programs list (see warmCanvasProgramCache).
//
// What gets cached is the raw course metadata plus per-facility enrollment counts
// rather than the expanded ProgramClass rows: the statewide view is a
// facility × course cross product that would blow past the NATS message size
// limit, and expanding it in Go on each request costs nothing.

// canvasClassesFreshFor is how long a cached entry is served without triggering a
// background refresh. Entries older than this are still served immediately while
// the refresh runs (the KV bucket TTL is deliberately longer, see
// setupNatsKvBuckets).
const canvasClassesFreshFor = 5 * time.Minute

// canvasClassesRefreshTimeout bounds one background refresh. srv.Client has no
// timeout of its own, so without a deadline an unresponsive Canvas host would pin
// the refresh in flight and leave the cache stuck reporting Loading.
const canvasClassesRefreshTimeout = 5 * time.Minute

// cachedCanvasCourse is one Canvas course with its mapped enrollment counts
// broken down by facility, which is all the classes index needs.
type cachedCanvasCourse struct {
	RawID              uint               `json:"raw_id"`
	Name               string             `json:"name"`
	Description        string             `json:"description"`
	StartDt            time.Time          `json:"start_dt"`
	EndDt              *time.Time         `json:"end_dt"`
	Status             models.ClassStatus `json:"status"`
	EnrolledByFacility map[uint]int64     `json:"enrolled_by_facility"`
}

// CachedCanvasClasses is the NATS KV payload for one Canvas provider platform.
type CachedCanvasClasses struct {
	ProviderName string               `json:"provider_name"`
	Courses      []cachedCanvasCourse `json:"courses"`
	LastUpdated  time.Time            `json:"last_updated"`
	// Loading marks a refresh as in flight so concurrent requests neither
	// re-enter the fetch nor treat an empty payload as "no classes".
	Loading bool `json:"loading"`
}

type canvasCacheState int

const (
	// canvasCacheFresh - cached data is recent enough to serve as-is.
	canvasCacheFresh canvasCacheState = iota
	// canvasCacheLoading - a background refresh is already running.
	canvasCacheLoading
	// canvasCacheStale - data is present but expired; serve it and refresh.
	canvasCacheStale
	// canvasCacheMiss - nothing usable cached.
	canvasCacheMiss
)

func canvasClassesCacheKey(providerID uint) string {
	return fmt.Sprintf("canvas_classes_%d", providerID)
}

// getCanvasClasses builds the Canvas portion of the classes index from cache.
// facilityID nil (or 0) returns one class per facility × course for the statewide
// view; otherwise classes are scoped to that facility.
//
// The returned loading flag means at least one provider's data is still being
// fetched, so the caller should tell the client to poll rather than treat the
// result as complete.
func (srv *Server) getCanvasClasses(facilityID *uint) ([]models.ProgramClass, bool, error) {
	providers, err := srv.Db.GetAllActiveProviderPlatforms()
	if err != nil {
		return nil, false, err
	}
	canvasProviders := make([]models.ProviderPlatform, 0, len(providers))
	for _, provider := range providers {
		if isCanvasProvider(&provider) {
			canvasProviders = append(canvasProviders, provider)
		}
	}
	if len(canvasProviders) == 0 {
		return nil, false, nil
	}

	facilities, err := srv.canvasClassFacilities(facilityID)
	if err != nil {
		return nil, false, err
	}

	kv := srv.buckets[CanvasClasses]
	if kv == nil {
		// Without the cache there is nowhere to publish background results, so
		// fall back to fetching inline rather than returning nothing forever.
		log.Warn("canvas_classes NATS bucket is nil, fetching canvas classes inline")
		var result []models.ProgramClass
		for i := range canvasProviders {
			provider := &canvasProviders[i]
			courses, err := srv.fetchCanvasCoursesWithCounts(context.Background(), provider)
			if err != nil {
				log.WithError(err).Warnf("failed to fetch canvas courses for provider %d, skipping", provider.ID)
				continue
			}
			result = append(result, expandCanvasClasses(provider, courses, facilities)...)
		}
		return result, false, nil
	}

	var (
		result  []models.ProgramClass
		loading bool
	)
	for i := range canvasProviders {
		provider := &canvasProviders[i]
		cached, state := srv.readCanvasClassesCache(provider.ID)
		if state == canvasCacheMiss || state == canvasCacheStale {
			var stale []cachedCanvasCourse
			if cached != nil {
				stale = cached.Courses
			}
			srv.warmCanvasClassesCache(provider, stale)
		}
		if state != canvasCacheFresh {
			loading = true
		}
		if cached != nil {
			result = append(result, expandCanvasClasses(provider, cached.Courses, facilities)...)
		}
	}
	return result, loading, nil
}

// canvasClassFacilities resolves the facilities the Canvas classes are expanded
// over: every facility for the statewide view, or just the requested one.
func (srv *Server) canvasClassFacilities(facilityID *uint) ([]models.Facility, error) {
	if facilityID == nil || *facilityID == 0 {
		return srv.Db.GetAllFacilitiesOrdered()
	}
	facility, err := srv.Db.GetFacilityByID(int(*facilityID))
	if err != nil {
		return nil, err
	}
	return []models.Facility{*facility}, nil
}

// readCanvasClassesCache returns the cached payload for a provider (possibly
// stale, possibly nil) along with what the caller should do about it.
func (srv *Server) readCanvasClassesCache(providerID uint) (*CachedCanvasClasses, canvasCacheState) {
	kv := srv.buckets[CanvasClasses]
	if kv == nil {
		return nil, canvasCacheMiss
	}
	entry, err := kv.Get(canvasClassesCacheKey(providerID))
	if err != nil {
		return nil, canvasCacheMiss
	}
	var cached CachedCanvasClasses
	if err := json.Unmarshal(entry.Value(), &cached); err != nil {
		log.WithError(err).Warnf("readCanvasClassesCache: corrupt entry for provider %d", providerID)
		return nil, canvasCacheMiss
	}
	switch {
	case cached.Loading && cached.LastUpdated.Add(canvasClassesRefreshTimeout).After(time.Now()):
		return &cached, canvasCacheLoading
	case cached.Loading:
		// A refresh that outlived its own timeout never wrote a result (e.g. the
		// process restarted mid-fetch); treat it as stale so it gets retried
		// instead of reporting Loading until the bucket TTL expires.
		return &cached, canvasCacheStale
	case cached.LastUpdated.Add(canvasClassesFreshFor).After(time.Now()):
		return &cached, canvasCacheFresh
	default:
		return &cached, canvasCacheStale
	}
}

// warmCanvasClassesCache fires a background goroutine that refreshes the Canvas
// course cache for one provider. stale is the data already cached, which is kept
// in place (flagged Loading) so requests during the refresh still see classes,
// and restored if the refresh fails.
func (srv *Server) warmCanvasClassesCache(provider *models.ProviderPlatform, stale []cachedCanvasCourse) {
	if _, loaded := srv.canvasClassesInflight.LoadOrStore(provider.ID, struct{}{}); loaded {
		return
	}
	kv := srv.buckets[CanvasClasses]
	if kv == nil {
		srv.canvasClassesInflight.Delete(provider.ID)
		return
	}
	providerCopy := *provider
	cacheKey := canvasClassesCacheKey(provider.ID)
	putEntry := func(courses []cachedCanvasCourse, updated time.Time, loading bool) {
		payload := CachedCanvasClasses{
			ProviderName: providerCopy.Name,
			Courses:      courses,
			LastUpdated:  updated,
			Loading:      loading,
		}
		data, err := json.Marshal(payload)
		if err != nil {
			log.WithError(err).Warnf("warmCanvasClassesCache: failed to marshal entry for provider %d", providerCopy.ID)
			return
		}
		if _, err := kv.Put(cacheKey, data); err != nil {
			log.WithError(err).Warnf("warmCanvasClassesCache: failed to write entry for provider %d", providerCopy.ID)
		}
	}
	// Claim the key before returning so a request arriving a moment later sees
	// Loading rather than kicking off its own fetch.
	putEntry(stale, time.Now(), true)

	go func() {
		defer srv.canvasClassesInflight.Delete(providerCopy.ID)
		ctx, cancel := context.WithTimeout(context.Background(), canvasClassesRefreshTimeout)
		defer cancel()
		courses, err := srv.fetchCanvasCoursesWithCounts(ctx, &providerCopy)
		if err != nil {
			log.WithError(err).Warnf("warmCanvasClassesCache: failed to fetch canvas courses for provider %d", providerCopy.ID)
			if len(stale) > 0 {
				// Keep serving the last known good data instead of polling a
				// provider that is currently unreachable.
				putEntry(stale, time.Now(), false)
			} else if err := kv.Delete(cacheKey); err != nil {
				log.WithError(err).Warnf("warmCanvasClassesCache: failed to clear entry for provider %d", providerCopy.ID)
			}
			return
		}
		putEntry(courses, time.Now(), false)
		log.Debugf("warmCanvasClassesCache: cached %d canvas courses for provider %d", len(courses), providerCopy.ID)
	}()
}

// fetchCanvasCoursesWithCounts lists every course for a Canvas provider and
// resolves each course's mapped enrollment counts per facility. This is the
// expensive, network-bound work the cache exists to keep off the request path.
func (srv *Server) fetchCanvasCoursesWithCounts(ctx context.Context, provider *models.ProviderPlatform) ([]cachedCanvasCourse, error) {
	apiURL := provider.BaseUrl + "/api/v1/accounts/" + provider.AccountID + "/courses?per_page=100"
	rawCourses, err := srv.fetchAllCanvasPages(ctx, provider, apiURL, 0)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	entries := make([]canvasCourseEntry, 0, len(rawCourses))
	for _, course := range rawCourses {
		entry, ok := parseCanvasCourse(course, provider.ID, now)
		if !ok {
			continue
		}
		entries = append(entries, entry)
	}
	// One Canvas call plus one DB query per course, returning counts for every
	// facility at once, so this stays O(courses) rather than O(courses × facilities).
	courses := make([]cachedCanvasCourse, len(entries))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 10)
	for i := range entries {
		wg.Add(1)
		sem <- struct{}{}
		go func(idx int) {
			defer wg.Done()
			defer func() { <-sem }()
			counts := srv.countMappedCanvasEnrolleesPerFacility(ctx, provider, entries[idx].rawID)
			if counts == nil {
				counts = map[uint]int64{}
			}
			courses[idx] = cachedCanvasCourse{
				RawID:              entries[idx].rawID,
				Name:               entries[idx].name,
				Description:        entries[idx].description,
				StartDt:            entries[idx].startDt,
				EndDt:              entries[idx].endDt,
				Status:             entries[idx].status,
				EnrolledByFacility: counts,
			}
		}(i)
	}
	wg.Wait()
	return courses, nil
}

// expandCanvasClasses turns cached course data into the ProgramClass rows the
// classes index returns, one per facility × course.
func expandCanvasClasses(provider *models.ProviderPlatform, courses []cachedCanvasCourse, facilities []models.Facility) []models.ProgramClass {
	programID := models.CanvasProgramIDOffset + provider.ID
	result := make([]models.ProgramClass, 0, len(courses)*len(facilities))
	for i := range facilities {
		facility := &facilities[i]
		for _, course := range courses {
			result = append(result, models.ProgramClass{
				DatabaseFields: models.DatabaseFields{ID: encodeFacilityCanvasClassID(facility.ID, provider.ID, course.RawID)},
				ProgramID:      programID,
				FacilityID:     facility.ID,
				Facility:       facility,
				Name:           course.Name,
				Description:    course.Description,
				StartDt:        course.StartDt,
				EndDt:          course.EndDt,
				Status:         course.Status,
				Enrolled:       course.EnrolledByFacility[facility.ID],
				IsCanvas:       true,
				Program: &models.Program{
					DatabaseFields: models.DatabaseFields{ID: programID},
					Name:           "College - " + provider.Name,
				},
			})
		}
	}
	return result
}

// invalidateCanvasClassesCache drops the cached course data for a provider so the
// next classes request refreshes it. Called when Canvas user mappings change,
// since those feed the enrollment counts.
func (srv *Server) invalidateCanvasClassesCache(providerID uint) {
	kv := srv.buckets[CanvasClasses]
	if kv == nil {
		return
	}
	if err := kv.Delete(canvasClassesCacheKey(providerID)); err != nil {
		log.WithError(err).Warnf("invalidateCanvasClassesCache: failed to delete entry for provider %d", providerID)
	}
}
