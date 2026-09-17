package handlers

import (
	"UnlockEdv2/src/models"
	"UnlockEdv2/src/services"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	log "github.com/sirupsen/logrus"
)

type CachedCanvasProgram struct {
	Program        models.ProgramsOverviewTable
	LastUpdated    time.Time
	CompletionRate float64
	Loading        bool
}

// liveCourse holds one provider course normalized into the shape the live
// program path uses, regardless of which provider it came from.
type liveCourse struct {
	encodedID      uint
	rawID          uint
	name           string
	description    string
	startDt        time.Time
	endDt          *time.Time
	status         models.ClassStatus
	enrolleeIDs    []string
	weeklySchedule map[time.Weekday][]meetingTime
}

type meetingTime struct {
	startMin int
	endMin   int
}

// isCanvasProvider returns true when the provider is a Canvas (OSS or Cloud) instance.
func isCanvasProvider(p *models.ProviderPlatform) bool {
	return p.Type == models.CanvasOSS || p.Type == models.CanvasCloud
}

// encodeCanvasClassID packs (providerID, rawCourseID) into the synthetic class ID.
// decodeCanvasClassID is the reverse.
func encodeCanvasClassID(providerID, rawCourseID uint) uint {
	return models.CanvasClassIDOffset + providerID*1_000_000 + rawCourseID
}

// parseCanvasCourse extracts metadata from a raw Canvas API course map.
// Returns (entry, true) on success, or the zero value and false when the map
// has no valid numeric id field.
func parseCanvasCourse(course map[string]interface{}, providerID uint, now time.Time) (liveCourse, bool) {
	idFloat, ok := course["id"].(float64)
	if !ok {
		return liveCourse{}, false
	}
	rawID := uint(idFloat)
	if !courseIDFitsEncoding(rawID) {
		log.Warnf("canvas course %d exceeds the synthetic class ID range, skipping", rawID)
		return liveCourse{}, false
	}
	name, _ := course["name"].(string)
	description, _ := course["course_code"].(string)
	var startDt time.Time
	if s, ok := course["start_at"].(string); ok && s != "" {
		startDt, _ = time.Parse("2006-01-02T15:04:05Z", s)
	}
	var endDt *time.Time
	status := models.Active
	if s, ok := course["end_at"].(string); ok && s != "" {
		if t, err := time.Parse("2006-01-02T15:04:05Z", s); err == nil {
			endDt = &t
			if !t.After(now) {
				status = models.Completed
			}
		}
	}
	return liveCourse{
		encodedID:   encodeCanvasClassID(providerID, rawID),
		rawID:       rawID,
		name:        name,
		description: description,
		startDt:     startDt,
		endDt:       endDt,
		status:      status,
	}, true
}

// buildCourseTimezoneMap extracts the "time_zone" field from each Canvas API
// course map and returns a mapping of raw course ID → IANA timezone string.
func buildCourseTimezoneMap(courses []map[string]interface{}) map[uint]string {
	courseTimezones := make(map[uint]string, len(courses))
	for _, course := range courses {
		if idFloat, ok := course["id"].(float64); ok {
			if tz, ok := course["time_zone"].(string); ok && tz != "" {
				courseTimezones[uint(idFloat)] = tz
			}
		}
	}
	return courseTimezones
}

// canvasMappedUser holds the local user record for a Canvas external_user_id.
type canvasMappedUser struct {
	UserID    uint
	NameFirst string
	NameLast  string
	DocID     string
}

// fetchCanvasMappedUsers resolves a slice of Canvas external user ID strings to
// their local user records via provider_user_mappings. When facilityID is non-zero
// only users in that facility are returned. Returns a map keyed by external_user_id.
func (srv *Server) fetchCanvasMappedUsers(providerID uint, canvasUserIDs []string, facilityID uint) (map[string]canvasMappedUser, error) {
	if len(canvasUserIDs) == 0 {
		return make(map[string]canvasMappedUser), nil
	}
	rows, err := srv.Db.GetCanvasMappedUsers(providerID, canvasUserIDs, facilityID)
	if err != nil {
		return nil, err
	}
	result := make(map[string]canvasMappedUser, len(rows))
	for _, r := range rows {
		result[r.ExternalUserID] = canvasMappedUser{
			UserID:    r.UserID,
			NameFirst: r.NameFirst,
			NameLast:  r.NameLast,
			DocID:     r.DocID,
		}
	}
	return result, nil
}

// fetchCanvasCourseEnrolleeIDs fetches active student enrollments for a Canvas
// course and returns the Canvas user IDs as strings, ready to query
// provider_user_mappings.external_user_id.
func (srv *Server) fetchCanvasCourseEnrolleeIDs(provider *models.ProviderPlatform, rawCourseID uint) ([]string, error) {
	ids, _, err := srv.fetchCanvasCourseEnrollmentData(provider, rawCourseID)
	return ids, err
}

// fetchCanvasCourseEnrollmentData fetches active student enrollments for a Canvas
// course and returns both the Canvas user IDs and a map of userID → enrollment created_at.
func (srv *Server) fetchCanvasCourseEnrollmentData(provider *models.ProviderPlatform, rawCourseID uint) ([]string, map[string]*time.Time, error) {
	enrollURL := fmt.Sprintf(
		"%s/api/v1/courses/%d/enrollments?type[]=StudentEnrollment&state[]=active&per_page=100",
		provider.BaseUrl, rawCourseID,
	)
	enrollments, err := srv.fetchAllCanvasPages(context.Background(), provider, enrollURL, 0)
	if err != nil {
		return nil, nil, err
	}
	ids := make([]string, 0, len(enrollments))
	dates := make(map[string]*time.Time, len(enrollments))
	for _, e := range enrollments {
		if u, ok := e["user"].(map[string]interface{}); ok {
			if id, ok := u["id"].(float64); ok {
				userIDStr := fmt.Sprintf("%d", int(id))
				ids = append(ids, userIDStr)
				if createdAtStr, ok := e["created_at"].(string); ok && createdAtStr != "" {
					if t, err := time.Parse(time.RFC3339, createdAtStr); err == nil {
						dates[userIDStr] = &t
					}
				}
			}
		}
	}
	return ids, dates, nil
}

// canvasProgramCacheTTL is how long a cached program entry is served before it
// is refreshed.
const canvasProgramCacheTTL = 5 * time.Minute

// canvasCacheRetryDelay is how long a failed refresh is left alone before the
// next request retries it.
const canvasCacheRetryDelay = 30 * time.Second

// retryableCacheTimestamp dates an entry so it reads as stale once
// canvasCacheRetryDelay has passed. A refresh that failed writes this rather
// than time.Now(), so the entry is neither a loading marker that never resolves
// nor an empty result served as fresh for a whole TTL.
func retryableCacheTimestamp(ttl time.Duration) time.Time {
	return time.Now().Add(canvasCacheRetryDelay - ttl)
}

// warmCanvasProgramCache fires a background goroutine that fetches program data
// from Canvas and writes the result to NATS KV at cacheKey. An in-flight dedup
// guard (canvasInflight) prevents concurrent fetches for the same provider.
// previous is the stale entry being replaced, if there was one; a failed fetch
// restores it so the caller's loading marker does not outlive the attempt.
func (srv *Server) warmCanvasProgramCache(provider *models.ProviderPlatform, facilityID uint, cacheKey string, previous *models.ProgramsOverviewTable) {
	key := provider.ID
	if _, loaded := srv.canvasInflight.LoadOrStore(key, struct{}{}); loaded {
		return
	}
	kv := srv.buckets[CanvasPrograms]
	providerCopy := *provider
	go func() {
		defer srv.canvasInflight.Delete(key)
		result, err := srv.fetchCanvasProviderProgram(&providerCopy, facilityID)
		if err != nil {
			log.WithError(err).Warnf("warmCanvasProgramCache: failed to fetch canvas program for provider %d", providerCopy.ID)
			// The caller wrote a loading marker before firing this off. Replace it,
			// or the reads below return that marker ahead of any freshness check and
			// the view stays in the loading state until the entry expires.
			srv.restoreCanvasProgram(cacheKey, previous)
			return
		}
		if kv == nil {
			return
		}
		cached := CachedCanvasProgram{Program: result, LastUpdated: time.Now(), Loading: false}
		data, err := json.Marshal(cached)
		if err != nil {
			return
		}
		if _, err := kv.Put(cacheKey, data); err != nil {
			log.WithError(err).Warnf("warmCanvasProgramCache: failed to store canvas program for provider %d", providerCopy.ID)
			return
		}
		// Kick off completion-rate computation in the background.
		// Uses the global (facility=0) key so all callers share the result.
		globalKey := fmt.Sprintf("canvas_program_%d_0", providerCopy.ID)
		go func(p models.ProviderPlatform, gKey string) {
			rateCtx, rateCancel := context.WithTimeout(context.Background(), 90*time.Second)
			defer rateCancel()
			log.Debugf("background: starting completion rate computation for provider %d", p.ID)
			rate := srv.computeCanvasCompletionRate(rateCtx, &p)
			log.Debugf("background: completion rate for provider %d = %.2f%%", p.ID, rate)
			entry, err := kv.Get(gKey)
			if err != nil {
				return
			}
			var c CachedCanvasProgram
			if json.Unmarshal(entry.Value(), &c) != nil {
				return
			}
			c.CompletionRate = rate
			if d, err := json.Marshal(c); err == nil {
				if _, err := kv.Put(gKey, d); err != nil {
					log.WithError(err).Warnf("background: failed to update completion rate for provider %d", p.ID)
				}
			}
			log.Debugf("background: completion rate cached for provider %d", p.ID)
		}(providerCopy, globalKey)
	}()
}

// restoreCanvasProgram puts a failed refresh back into a retryable state: the
// stale entry it was replacing, dated so the next request refreshes it, or no
// entry at all when there is nothing worth serving.
func (srv *Server) restoreCanvasProgram(cacheKey string, previous *models.ProgramsOverviewTable) {
	kv := srv.buckets[CanvasPrograms]
	if kv == nil {
		return
	}
	if previous == nil {
		if err := kv.Delete(cacheKey); err != nil {
			log.WithError(err).Warnf("restoreCanvasProgram: failed to clear loading marker at %s", cacheKey)
		}
		return
	}
	cached := CachedCanvasProgram{
		Program:     *previous,
		LastUpdated: retryableCacheTimestamp(canvasProgramCacheTTL),
	}
	data, err := json.Marshal(cached)
	if err != nil {
		return
	}
	if _, err := kv.Put(cacheKey, data); err != nil {
		log.WithError(err).Warnf("restoreCanvasProgram: failed to restore entry at %s", cacheKey)
	}
}

// getCanvasProviderPrograms returns one synthetic ProgramsOverviewTable entry per
// enabled Canvas provider platform. Results are served from NATS KV when fresh
// (< 5 min old). On cache miss or stale entry a loading placeholder is written
// to KV and warmCanvasProgramCache is fired in the background, returning a
// Loading=true entry so the frontend can poll until data is ready.
// When adminRole is FacilityAdmin, enrollment counts are scoped to facilityID.
func (srv *Server) getCanvasProviderPrograms(facilityID uint, adminRole models.UserRole) ([]models.ProgramsOverviewTable, error) {
	providers, err := srv.Db.GetAllActiveProviderPlatforms()
	if err != nil {
		return nil, err
	}
	kv := srv.buckets[CanvasPrograms]
	if kv == nil {
		log.Warn("canvas_programs NATS bucket is nil, skipping cache")
	}
	var result []models.ProgramsOverviewTable

	scopedFacilityID := uint(0)
	if adminRole == models.FacilityAdmin {
		scopedFacilityID = facilityID
	}

	for _, provider := range providers {
		if !isLiveProgramProvider(&provider) {
			continue
		}
		cacheKey := fmt.Sprintf("canvas_program_%d_%d", provider.ID, scopedFacilityID)

		var previous *models.ProgramsOverviewTable
		if kv != nil {
			if entry, err := kv.Get(cacheKey); err == nil {
				var cached CachedCanvasProgram
				if json.Unmarshal(entry.Value(), &cached) == nil {
					if cached.Loading {
						// Computation already in progress — return placeholder.
						placeholder := cached.Program
						placeholder.Loading = true
						result = append(result, placeholder)
						continue
					}
					if cached.LastUpdated.Add(canvasProgramCacheTTL).After(time.Now()) {
						result = append(result, cached.Program)
						continue
					}
					stale := cached.Program
					previous = &stale
				}
			}
		}

		// Cache miss or stale — write a loading placeholder and kick off background fetch.
		if kv != nil {
			placeholder := models.ProgramsOverviewTable{
				ProgramID:   models.CanvasProgramIDOffset + provider.ID,
				ProgramName: provider.Name,
				Source:      providerSourceLabel(&provider),
				Status:      true,
				Loading:     true,
			}
			if data, err := json.Marshal(CachedCanvasProgram{Program: placeholder, LastUpdated: time.Now(), Loading: true}); err == nil {
				if _, err := kv.Put(cacheKey, data); err != nil {
					log.WithError(err).Warn("getCanvasProviderPrograms: failed to write loading placeholder")
				}
			}
		}
		providerCopy := provider
		srv.warmCanvasProgramCache(&providerCopy, scopedFacilityID, cacheKey, previous)
		result = append(result, models.ProgramsOverviewTable{
			ProgramID:   models.CanvasProgramIDOffset + provider.ID,
			ProgramName: provider.Name,
			Source:      providerSourceLabel(&provider),
			Status:      true,
			Loading:     true,
		})
	}
	return result, nil
}

// fetchCanvasProviderProgram calls:
//
//	GET /api/v1/accounts/{accountID}/courses?per_page=100
//
// and builds the synthetic program entry. When facilityID is non-zero, enrollment
// counts are scoped to users belonging to that facility.
// active enrollment is the sum of per-course mapped enrollees (matching the detail
// page calculation), while total enrollment is the all-time provider_user_mappings count.
func (srv *Server) fetchCanvasProviderProgram(provider *models.ProviderPlatform, facilityID uint) (models.ProgramsOverviewTable, error) {
	reader, err := srv.newLiveProgramProvider(provider)
	if err != nil {
		return models.ProgramsOverviewTable{}, err
	}
	ctx := context.Background()
	listing, err := reader.ListCourses(ctx)
	if err != nil {
		return models.ProgramsOverviewTable{}, err
	}

	// Class counts are reported against everything the provider returned, so a
	// record we could not parse still counts toward the total.
	totalClasses := int64(listing.Total)
	var activeClasses int64
	for _, course := range listing.Courses {
		if course.status == models.Active {
			activeClasses++
		}
	}

	// Sum per-course mapped enrollee counts concurrently, scoped to facility when set.
	// This matches the calculation used on the program detail page.
	var activeEnrollments int64
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, course := range listing.Courses {
		if course.status != models.Active {
			continue
		}
		wg.Add(1)
		go func(c liveCourse) {
			defer wg.Done()
			var n int64
			if facilityID != 0 {
				n = srv.countMappedCanvasEnrolleesForFacility(ctx, reader, provider, c, facilityID)
			} else {
				n = srv.countMappedCanvasEnrollees(ctx, reader, provider, c)
			}
			mu.Lock()
			activeEnrollments += n
			mu.Unlock()
		}(course)
	}
	wg.Wait()

	programID := models.CanvasProgramIDOffset + provider.ID
	return models.ProgramsOverviewTable{
		ProgramID:              programID,
		ProgramName:            provider.Name,
		Description:            "Courses pulled live from " + providerDisplayName(provider) + " connection: " + provider.Name,
		TotalEnrollments:       &activeEnrollments,
		TotalActiveEnrollments: &activeEnrollments,
		TotalClasses:           &totalClasses,
		TotalActiveClasses:     &activeClasses,
		Types:                  "College",
		Status:                 true,
		Source:                 providerSourceLabel(provider),
	}, nil
}

// fetchAllCanvasPages fetches pages from a Canvas API endpoint and returns the combined results.
// max limits the total number of items returned; 0 means no limit (fetch all pages).
func (srv *Server) fetchAllCanvasPages(ctx context.Context, provider *models.ProviderPlatform, startURL string, max int) ([]map[string]interface{}, error) {
	var all []map[string]interface{}
	for pageURL := startURL; pageURL != ""; {
		req, err := http.NewRequestWithContext(ctx, "GET", pageURL, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Add("Authorization", "Bearer "+provider.AccessKey)
		req.Header.Add("Accept", "application/json")
		resp, err := srv.Client.Do(req)
		if err != nil {
			return nil, err
		}
		if resp.StatusCode != http.StatusOK {
			_ = resp.Body.Close()
			return nil, fmt.Errorf("canvas API returned %d", resp.StatusCode)
		}
		var page []map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&page); err != nil {
			_ = resp.Body.Close()
			return nil, err
		}
		pageURL = NextPageURL(resp.Header.Get("Link"))
		_ = resp.Body.Close()
		all = append(all, page...)
		if max > 0 && len(all) >= max {
			break
		}
	}
	return all, nil
}

// NextPageURL parses an RFC 5988 Link header and returns the URL for rel="next",
// or an empty string if there is no next page.
// It handles quoted strings, varied whitespace, arbitrary attribute order,
// case-insensitive rel tokens, and URIs that contain commas or semicolons.
func NextPageURL(header string) string {
	for _, entry := range splitLinkEntries(header) {
		entry = strings.TrimSpace(entry)
		if !strings.HasPrefix(entry, "<") {
			continue
		}
		uriEnd := strings.IndexByte(entry, '>')
		if uriEnd < 0 {
			continue
		}
		uri := entry[1:uriEnd]
		if linkEntryHasRelNext(entry[uriEnd+1:]) {
			return uri
		}
	}
	return ""
}

// splitLinkEntries splits a Link header value by top-level commas (i.e. commas
// not inside angle brackets or double-quoted strings).
func splitLinkEntries(header string) []string {
	var entries []string
	depth, start := 0, 0
	inQuote := false
	for i := 0; i < len(header); i++ {
		switch header[i] {
		case '<':
			if !inQuote {
				depth++
			}
		case '>':
			if !inQuote && depth > 0 {
				depth--
			}
		case '"':
			inQuote = !inQuote
		case '\\':
			if inQuote && i+1 < len(header) {
				i++ // skip escaped character inside quoted string
			}
		case ',':
			if depth == 0 && !inQuote {
				entries = append(entries, header[start:i])
				start = i + 1
			}
		}
	}
	return append(entries, header[start:])
}

// linkEntryHasRelNext reports whether the parameter portion of a Link entry
// contains a rel attribute whose value includes the token "next"
// (case-insensitive; handles quoted values and multiple space-separated tokens).
func linkEntryHasRelNext(params string) bool {
	inQuote, start := false, 0
	checkParam := func(p string) bool {
		p = strings.TrimSpace(p)
		eq := strings.IndexByte(p, '=')
		if eq < 0 || !strings.EqualFold(strings.TrimSpace(p[:eq]), "rel") {
			return false
		}
		val := strings.TrimSpace(p[eq+1:])
		if len(val) >= 2 && val[0] == '"' && val[len(val)-1] == '"' {
			val = val[1 : len(val)-1]
		}
		for _, tok := range strings.Fields(val) {
			if strings.EqualFold(tok, "next") {
				return true
			}
		}
		return false
	}
	for i := 0; i < len(params); i++ {
		switch params[i] {
		case '"':
			inQuote = !inQuote
		case '\\':
			if inQuote && i+1 < len(params) {
				i++
			}
		case ';':
			if !inQuote {
				if checkParam(params[start:i]) {
					return true
				}
				start = i + 1
			}
		}
	}
	return checkParam(params[start:])
}

// fetchCanvasCalendarEvents fetches individual Canvas calendar events for all
// courses in the given provider for the specified date range.
func (srv *Server) fetchCanvasCalendarEvents(
	provider *models.ProviderPlatform,
	start, end time.Time,
	loc *time.Location,
) ([]models.FacilityProgramClassEvent, error) {
	// Step 1: fetch all courses for this provider (paginated)
	reader, err := srv.newLiveProgramProvider(provider)
	if err != nil {
		return nil, err
	}
	listing, err := reader.ListCourses(context.Background())
	if err != nil {
		return nil, fmt.Errorf("fetching courses for provider %d: %w", provider.ID, err)
	}

	if listing.Total == 0 {
		return []models.FacilityProgramClassEvent{}, nil
	}

	courseTimezones := listing.Timezones

	// Providers that describe a weekly meeting pattern rather than dated calendar
	// events have no calendar endpoint to call, so their pattern is expanded onto
	// the same facility calendar.
	if !isCanvasProvider(provider) {
		return weeklyScheduleFacilityEvents(provider, listing.Courses, start, end, loc), nil
	}

	// Step 2: build context_codes[] query params using url.Values so brackets are encoded
	params := url.Values{}
	params.Set("start_date", start.Format("2006-01-02"))
	params.Set("end_date", end.Format("2006-01-02"))
	params.Set("per_page", "100")
	for _, course := range listing.Courses {
		params.Add("context_codes[]", fmt.Sprintf("course_%d", course.rawID))
	}
	rawEvents, err := srv.fetchAllCanvasPages(context.Background(), provider, provider.BaseUrl+"/api/v1/calendar_events?"+params.Encode(), 0)
	if err != nil {
		return nil, fmt.Errorf("canvas API error fetching calendar events for provider %d: %w", provider.ID, err)
	}

	var events []models.FacilityProgramClassEvent
	for _, event := range rawEvents {
		startAtStr, _ := event["start_at"].(string)
		endAtStr, _ := event["end_at"].(string)
		if startAtStr == "" || endAtStr == "" {
			continue
		}
		startAt, err := time.Parse(time.RFC3339, startAtStr)
		if err != nil {
			continue
		}
		endAt, err := time.Parse(time.RFC3339, endAtStr)
		if err != nil {
			continue
		}

		title, _ := event["title"].(string)
		isCancelled := event["workflow_state"] == "deleted"

		var id uint
		if idFloat, ok := event["id"].(float64); ok {
			id = encodeCanvasClassID(provider.ID, uint(idFloat))
		}

		var classID uint
		var canvasTimezone string
		if contextCode, ok := event["context_code"].(string); ok && strings.HasPrefix(contextCode, "course_") {
			if rawCourseID, err := strconv.ParseUint(strings.TrimPrefix(contextCode, "course_"), 10, 64); err == nil {
				classID = encodeCanvasClassID(provider.ID, uint(rawCourseID))
				canvasTimezone = courseTimezones[uint(rawCourseID)]
			}
		}

		ev := models.FacilityProgramClassEvent{
			IsCanvasEvent:  true,
			Source:         providerSourceLabel(provider),
			IsCancelled:    isCancelled,
			ProgramID:      models.CanvasProgramIDOffset + provider.ID,
			ProgramName:    provider.Name,
			ClassName:      title,
			StartTime:      &startAt,
			EndTime:        &endAt,
			ClassStatus:    models.Active,
			CanvasTimezone: canvasTimezone,
		}
		ev.ID = id
		ev.CohortID = classID
		events = append(events, ev)
	}
	return events, nil
}

// weeklyScheduleFacilityEvents expands every course's weekly meeting pattern into
// facility calendar events across [start, end]. Occurrences of a class share the
// class's synthetic ID -- the calendar renders from the event objects themselves
// and never looks one up by ID.
func weeklyScheduleFacilityEvents(
	provider *models.ProviderPlatform,
	courses []liveCourse,
	start, end time.Time,
	loc *time.Location,
) []models.FacilityProgramClassEvent {
	var events []models.FacilityProgramClassEvent
	for _, course := range courses {
		// A weekly pattern has no end of its own, so a completed class would keep
		// emitting meetings forever -- including ones dated after it finished. Any
		// other status is emitted and carried through on the event itself.
		if course.status == models.Completed {
			continue
		}
		classID := encodeCanvasClassID(provider.ID, course.rawID)
		for _, occurrence := range expandWeeklySchedule(course, start, end, loc) {
			ev := models.FacilityProgramClassEvent{
				IsCanvasEvent: true,
				Source:        providerSourceLabel(provider),
				ProgramID:     models.CanvasProgramIDOffset + provider.ID,
				ProgramName:   provider.Name,
				ClassName:     course.name,
				StartTime:     &occurrence.StartAt,
				EndTime:       &occurrence.EndAt,
				ClassStatus:   course.status,
				// Without this the calendar would re-interpret the wall-clock time
				// in the viewer's own zone and shift every meeting.
				CanvasTimezone: occurrence.Timezone,
			}
			ev.ID = classID
			ev.CohortID = classID
			events = append(events, ev)
		}
	}
	return events
}

// fetchCanvasClassesAllProviders returns a ProgramClassCohort for every Canvas course
// across all active Canvas provider platforms. Failures per-provider are logged
// and skipped so a single unreachable provider doesn't break the response.
// facilityID must be non-nil and non-zero; for the statewide (all-facilities) case
// use fetchCanvasClassesAllProvidersAllFacilities instead.
func (srv *Server) fetchCanvasClassesAllProviders(facilityID *uint) ([]models.ProgramClassCohort, error) {
	providers, err := srv.Db.GetAllActiveProviderPlatforms()
	if err != nil {
		return nil, err
	}
	var facility *models.Facility
	if facilityID != nil && *facilityID != 0 {
		if f, err := srv.Db.GetFacilityByID(int(*facilityID)); err == nil {
			facility = f
		}
	}
	var result []models.ProgramClassCohort
	for _, provider := range providers {
		if !isLiveProgramProvider(&provider) {
			continue
		}
		programID := models.CanvasProgramIDOffset + provider.ID
		reader, err := srv.newLiveProgramProvider(&provider)
		if err != nil {
			log.WithError(err).Warnf("no live reader for provider %d, skipping", provider.ID)
			continue
		}
		ctx := context.Background()
		listing, err := reader.ListCourses(ctx)
		if err != nil {
			log.WithError(err).Warnf("failed to fetch canvas courses for provider %d, skipping", provider.ID)
			continue
		}
		entries := listing.Courses
		if facilityID == nil || *facilityID == 0 {
			continue
		}
		counts := make([]int64, len(entries))
		var wg sync.WaitGroup
		var mu sync.Mutex
		sem := make(chan struct{}, 10)
		for i := range entries {
			wg.Add(1)
			sem <- struct{}{}
			go func(idx int) {
				defer wg.Done()
				defer func() { <-sem }()
				n := srv.countMappedCanvasEnrolleesForFacility(ctx, reader, &provider, entries[idx], *facilityID)
				mu.Lock()
				counts[idx] = n
				mu.Unlock()
			}(i)
		}
		wg.Wait()
		for i, entry := range entries {
			result = append(result, models.ProgramClassCohort{
				DatabaseFields: models.DatabaseFields{ID: encodeFacilityCanvasClassID(*facilityID, provider.ID, entry.rawID)},
				ProgramID:      programID,
				FacilityID:     *facilityID,
				Facility:       facility,
				// Canvas courses have no row in the class tier, so nothing joins
				// class_name for them. Set it from the course title so the field is
				// populated for every cohort the API returns, Canvas or not.
				ClassName:   entry.name,
				Description: entry.description,
				StartDt:     entry.startDt,
				EndDt:       entry.endDt,
				Status:      entry.status,
				Enrolled:    counts[i],
				IsCanvas:    true,
				Source:      providerSourceLabel(&provider),
				Program: &models.Program{
					DatabaseFields: models.DatabaseFields{ID: programID},
					Name:           "College - " + provider.Name,
				},
			})
		}
	}
	return result, nil
}

// fetchCanvasClassesAllProvidersAllFacilities returns one ProgramClassCohort per
// (facility × Canvas course) with facility-scoped IDs. Used by the statewide
// classes index when facility=all so every returned class has a navigable,
// facility-scoped ID.
func (srv *Server) fetchCanvasClassesAllProvidersAllFacilities() ([]models.ProgramClassCohort, error) {
	providers, err := srv.Db.GetAllActiveProviderPlatforms()
	if err != nil {
		return nil, err
	}
	facilities, err := srv.Db.GetAllFacilitiesOrdered()
	if err != nil {
		return nil, err
	}
	var result []models.ProgramClassCohort
	for _, provider := range providers {
		if !isLiveProgramProvider(&provider) {
			continue
		}
		programID := models.CanvasProgramIDOffset + provider.ID
		reader, err := srv.newLiveProgramProvider(&provider)
		if err != nil {
			log.WithError(err).Warnf("no live reader for provider %d, skipping", provider.ID)
			continue
		}
		ctx := context.Background()
		listing, err := reader.ListCourses(ctx)
		if err != nil {
			log.WithError(err).Warnf("failed to fetch canvas courses for provider %d, skipping", provider.ID)
			continue
		}
		entries := listing.Courses
		// Fetch per-facility enrollment counts for each course concurrently.
		// countMappedCanvasEnrolleesPerFacility returns counts for all facilities at
		// once, so this is O(courses) rather than O(courses × facilities).
		facilityCounts := make([]map[uint]int64, len(entries))
		var wg sync.WaitGroup
		var mu sync.Mutex
		sem := make(chan struct{}, 10)
		for i := range entries {
			wg.Add(1)
			sem <- struct{}{}
			go func(idx int) {
				defer wg.Done()
				defer func() { <-sem }()
				counts := srv.countMappedCanvasEnrolleesPerFacility(ctx, reader, &provider, entries[idx])
				mu.Lock()
				facilityCounts[idx] = counts
				mu.Unlock()
			}(i)
		}
		wg.Wait()
		for _, facility := range facilities {
			facilityPtr := facility
			for i, entry := range entries {
				enrolled := int64(0)
				if facilityCounts[i] != nil {
					enrolled = facilityCounts[i][facility.ID]
				}
				result = append(result, models.ProgramClassCohort{
					DatabaseFields: models.DatabaseFields{ID: encodeFacilityCanvasClassID(facility.ID, provider.ID, entry.rawID)},
					ProgramID:      programID,
					FacilityID:     facility.ID,
					Facility:       &facilityPtr,
					ClassName:      entry.name, // see fetchCanvasClassesAllProviders
					Description:    entry.description,
					StartDt:        entry.startDt,
					EndDt:          entry.endDt,
					Status:         entry.status,
					Enrolled:       enrolled,
					IsCanvas:       true,
					Source:         providerSourceLabel(&provider),
					Program: &models.Program{
						DatabaseFields: models.DatabaseFields{ID: programID},
						Name:           "College - " + provider.Name,
					},
				})
			}
		}
	}
	return result, nil
}

// appendCanvasEventsForFacility iterates all active Canvas provider platforms
// and collects calendar events for the given date range.
func (srv *Server) appendCanvasEventsForFacility(dtRng *models.DateRange, facilityID uint) ([]models.FacilityProgramClassEvent, error) {
	loc := srv.facilityLocation(facilityID)
	providers, err := srv.Db.GetAllActiveProviderPlatforms()
	if err != nil {
		return nil, err
	}
	var result []models.FacilityProgramClassEvent
	for _, provider := range providers {
		if !isLiveProgramProvider(&provider) {
			continue
		}
		evs, err := srv.fetchCanvasCalendarEvents(&provider, dtRng.Start, dtRng.End, loc)
		if err != nil {
			log.WithError(err).Warnf("failed to fetch canvas calendar events for provider %d, skipping", provider.ID)
			continue
		}
		result = append(result, evs...)
	}
	return result, nil
}

func (srv *Server) handleShowCanvasProgram(w http.ResponseWriter, r *http.Request, log sLog, programID uint) error {
	connectionID := programID - models.CanvasProgramIDOffset
	provider, err := srv.Db.GetProviderPlatformByID(int(connectionID))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if !isLiveProgramProvider(provider) {
		return newInvalidIdServiceError(fmt.Errorf("provider %d is not a live program provider", connectionID), "program ID")
	}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	if !claims.hasFeatureAccess(models.ProviderAccess) {
		return newInvalidIdServiceError(fmt.Errorf("provider access disabled for provider %d", connectionID), "program ID")
	}

	facilityID := srv.getQueryContext(r).FacilityID
	cacheKey := fmt.Sprintf("canvas_program_%d_%d", connectionID, facilityID)
	globalKey := fmt.Sprintf("canvas_program_%d_0", connectionID)
	kv := srv.buckets[CanvasPrograms]
	var previous *models.ProgramsOverviewTable

	// Try facility-scoped key first, then global key.
	if kv != nil {
		for _, key := range []string{cacheKey, globalKey} {
			entry, err := kv.Get(key)
			if err != nil {
				continue
			}
			var cached CachedCanvasProgram
			if json.Unmarshal(entry.Value(), &cached) != nil {
				continue
			}
			if cached.Loading {
				return writeJsonResponse(w, http.StatusOK, models.ProgramOverviewResponse{
					Program: models.Program{
						DatabaseFields:     models.DatabaseFields{ID: programID},
						Name:               "College - " + provider.Name,
						IsActive:           true,
						ProgramTypes:       []models.ProgramType{},
						ProgramCreditTypes: []models.ProgramCreditType{},
						Facilities:         []models.Facility{},
					},
					ActiveClassFacilityIDs: []int{},
					Source:                 providerSourceLabel(provider),
					Loading:                true,
				})
			}
			if cached.LastUpdated.Add(canvasProgramCacheTTL).After(time.Now()) {
				prog := cached.Program
				totalEnrollments := 0
				if prog.TotalEnrollments != nil {
					totalEnrollments = int(*prog.TotalEnrollments)
				}
				activeEnrollments := 0
				if prog.TotalActiveEnrollments != nil {
					activeEnrollments = int(*prog.TotalActiveEnrollments)
				}
				return writeJsonResponse(w, http.StatusOK, models.ProgramOverviewResponse{
					Program: models.Program{
						DatabaseFields:     models.DatabaseFields{ID: programID},
						Name:               "College - " + provider.Name,
						Description:        prog.Description,
						IsActive:           true,
						ProgramTypes:       []models.ProgramType{},
						ProgramCreditTypes: []models.ProgramCreditType{},
						Facilities:         []models.Facility{},
					},
					ActiveResidents:        activeEnrollments,
					ActiveEnrollments:      activeEnrollments,
					TotalEnrollments:       totalEnrollments,
					CompletionRate:         cached.CompletionRate,
					ActiveClassFacilityIDs: []int{},
					Source:                 providerSourceLabel(provider),
				})
			}
			stale := cached.Program
			previous = &stale
			break
		}
	}

	// Cache miss — write a loading placeholder, kick off warm, return loading response.
	if kv != nil {
		placeholder := models.ProgramsOverviewTable{
			ProgramID:   programID,
			ProgramName: "College - " + provider.Name,
			Source:      providerSourceLabel(provider),
			Status:      true,
			Loading:     true,
		}
		if data, err := json.Marshal(CachedCanvasProgram{Program: placeholder, LastUpdated: time.Now(), Loading: true}); err == nil {
			if _, putErr := kv.Put(cacheKey, data); putErr != nil {
				_ = putErr
			}
		}
	}
	srv.warmCanvasProgramCache(provider, facilityID, cacheKey, previous)
	return writeJsonResponse(w, http.StatusOK, models.ProgramOverviewResponse{
		Program: models.Program{
			DatabaseFields:     models.DatabaseFields{ID: programID},
			Name:               "College - " + provider.Name,
			IsActive:           true,
			ProgramTypes:       []models.ProgramType{},
			ProgramCreditTypes: []models.ProgramCreditType{},
			Facilities:         []models.Facility{},
		},
		ActiveClassFacilityIDs: []int{},
		Source:                 providerSourceLabel(provider),
		Loading:                true,
	})
}

func (srv *Server) handleGetCanvasClasses(w http.ResponseWriter, r *http.Request, log sLog, programID uint) error {
	connectionID := programID - models.CanvasProgramIDOffset
	provider, err := srv.Db.GetProviderPlatformByID(int(connectionID))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if !isLiveProgramProvider(provider) {
		return newInvalidIdServiceError(fmt.Errorf("provider %d is not a live program provider", connectionID), "program ID")
	}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	if !claims.hasFeatureAccess(models.ProviderAccess) {
		return newInvalidIdServiceError(fmt.Errorf("provider access disabled for provider %d", connectionID), "program ID")
	}

	facilityID := srv.getQueryContext(r).FacilityID
	if r.URL.Query().Get("all") == "true" || facilityID == 0 {
		return srv.handleGetCanvasClassesByFacility(w, r, provider, programID, connectionID)
	}

	reader, err := srv.newLiveProgramProvider(provider)
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	listing, err := reader.ListCourses(r.Context())
	if err != nil {
		return newInternalServerServiceError(err, "failed to fetch canvas courses")
	}

	courseTimezones := listing.Timezones

	classes := make([]models.ProgramClassDetail, 0, len(listing.Courses))
	for _, entry := range listing.Courses {
		classes = append(classes, models.ProgramClassDetail{
			ProgramClassCohort: models.ProgramClassCohort{
				DatabaseFields: models.DatabaseFields{ID: entry.encodedID},
				ProgramID:      programID,
				FacilityID:     0,
				ClassName:      entry.name, // see fetchCanvasClassesAllProviders
				Description:    entry.description,
				StartDt:        entry.startDt,
				EndDt:          entry.endDt,
				Status:         entry.status,
			},
			FacilityName: provider.Name,
		})
	}

	// Concurrently count mapped enrollees for each course, scoped to facility when set.
	counts := make(map[uint]int64, len(classes))
	var mu sync.Mutex
	var wg sync.WaitGroup
	for i := range classes {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			var n int64
			if facilityID != 0 {
				n = srv.countMappedCanvasEnrolleesForFacility(r.Context(), reader, provider, listing.Courses[idx], facilityID)
			} else {
				n = srv.countMappedCanvasEnrollees(r.Context(), reader, provider, listing.Courses[idx])
			}
			mu.Lock()
			counts[classes[idx].ID] = n
			mu.Unlock()
		}(i)
	}
	wg.Wait()

	for i := range classes {
		n := counts[classes[i].ID]
		classes[i].ProgramClassCohort.Enrolled = n
		classes[i].Enrolled = int(n)
	}

	// Batch-fetch upcoming calendar events to populate schedule info.
	scheduleEvents := srv.fetchCanvasCoursesScheduleEvents(provider, listing.Courses, srv.facilityLocation(facilityID))
	facilityTimezone := srv.getQueryContext(r).Timezone
	for i, cls := range classes {
		_, rawID := decodeCanvasClassID(cls.ID)
		if ev, ok := scheduleEvents[rawID]; ok {
			classes[i].Events = []models.ProgramClassEvent{ev}
			tz := courseTimezones[rawID]
			if tz == "" {
				tz = facilityTimezone
			}
			sched, _ := services.FormatClassScheduleAndRoom([]models.ProgramClassEvent{ev}, tz)
			classes[i].Schedule = sched
		}
	}

	// Swap non-scoped IDs for facility-scoped IDs now that all processing is done.
	// This must happen last because enrollment counting and schedule lookups use
	// decodeCanvasClassID on the old-style IDs.
	if facilityID != 0 {
		for i := range classes {
			_, rawID := decodeCanvasClassID(classes[i].ID)
			newID := encodeFacilityCanvasClassID(facilityID, connectionID, rawID)
			classes[i].ID = newID
			classes[i].FacilityID = facilityID
			for j := range classes[i].Events {
				classes[i].Events[j].CohortID = newID
			}
		}
	}

	args := srv.getQueryContext(r)
	args.Total = int64(len(classes))
	return writePaginatedResponse(w, http.StatusOK, classes, args.IntoMeta())
}

// handleGetCanvasClassesByFacility returns one ProgramClassDetail per (facility × Canvas course)
// with per-facility enrollment counts, used by the statewide overview so each facility row
// expands to show all Canvas courses with enrollment scoped to that facility.
func (srv *Server) handleGetCanvasClassesByFacility(w http.ResponseWriter, r *http.Request, provider *models.ProviderPlatform, programID, connectionID uint) error {
	// Fetch all Canvas courses.
	reader, err := srv.newLiveProgramProvider(provider)
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	listing, err := reader.ListCourses(r.Context())
	if err != nil {
		return newInternalServerServiceError(err, "failed to fetch canvas courses")
	}

	courseTimezones := listing.Timezones
	entries := listing.Courses

	// Get all facilities.
	facilities, err := srv.Db.GetAllFacilitiesOrdered()
	if err != nil {
		return newDatabaseServiceError(err)
	}

	// Concurrently fetch per-facility enrollment counts for each course.
	facilityCounts := make([]map[uint]int64, len(entries))
	var wg sync.WaitGroup
	var mu sync.Mutex
	for i := range entries {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			counts := srv.countMappedCanvasEnrolleesPerFacility(r.Context(), reader, provider, entries[idx])
			mu.Lock()
			facilityCounts[idx] = counts
			mu.Unlock()
		}(i)
	}
	wg.Wait()

	// Batch-fetch upcoming calendar events for all courses to derive schedule strings.
	scheduleEvents := srv.fetchCanvasCoursesScheduleEvents(provider, entries, srv.facilityLocation(srv.getQueryContext(r).FacilityID))
	facilityTimezone := srv.getQueryContext(r).Timezone

	// Build one row per (facility × course).
	classes := make([]models.ProgramClassDetail, 0, len(facilities)*len(entries))
	for _, facility := range facilities {
		for i, entry := range entries {
			enrolled := int64(0)
			if facilityCounts[i] != nil {
				enrolled = facilityCounts[i][facility.ID]
			}
			scopedID := encodeFacilityCanvasClassID(facility.ID, connectionID, entry.rawID)
			var sched string
			var evSlice []models.ProgramClassEvent
			if ev, ok := scheduleEvents[entry.rawID]; ok {
				ev.CohortID = scopedID
				evSlice = []models.ProgramClassEvent{ev}
				tz := courseTimezones[entry.rawID]
				if tz == "" {
					tz = facilityTimezone
				}
				sched, _ = services.FormatClassScheduleAndRoom(evSlice, tz)
			}
			classes = append(classes, models.ProgramClassDetail{
				ProgramClassCohort: models.ProgramClassCohort{
					DatabaseFields: models.DatabaseFields{ID: scopedID},
					ProgramID:      programID,
					FacilityID:     facility.ID,
					ClassName:      entry.name, // see fetchCanvasClassesAllProviders
					Description:    entry.description,
					StartDt:        entry.startDt,
					EndDt:          entry.endDt,
					Status:         entry.status,
					Enrolled:       enrolled,
					Events:         evSlice,
				},
				FacilityName: facility.Name,
				Enrolled:     int(enrolled),
				Schedule:     sched,
			})
		}
	}

	args := srv.getQueryContext(r)
	args.Total = int64(len(classes))
	return writePaginatedResponse(w, http.StatusOK, classes, args.IntoMeta())
}

// weekdayToRRuleDay converts a time.Weekday to the two-letter iCalendar abbreviation.
func weekdayToRRuleDay(day time.Weekday) string {
	switch day {
	case time.Monday:
		return "MO"
	case time.Tuesday:
		return "TU"
	case time.Wednesday:
		return "WE"
	case time.Thursday:
		return "TH"
	case time.Friday:
		return "FR"
	case time.Saturday:
		return "SA"
	default:
		return "SU"
	}
}

// buildCanvasEventRRule builds an iCalendar RRULE string and a Go duration string
// from a Canvas calendar event's start/end times and optional rrule fragment.
// When canvasRRule is present (e.g. "FREQ=WEEKLY;BYDAY=MO") it is combined with a
// DTSTART derived from startAt. When absent the event is treated as a single occurrence.
func buildCanvasEventRRule(startAt, endAt time.Time, canvasRRule string) (recurrenceRule, duration string) {
	duration = endAt.Sub(startAt).String()
	dtstart := "DTSTART:" + startAt.UTC().Format("20060102T150405Z")
	if canvasRRule != "" {
		rrulePart := canvasRRule
		if !strings.HasPrefix(rrulePart, "RRULE:") {
			rrulePart = "RRULE:" + rrulePart
		}
		recurrenceRule = dtstart + "\n" + rrulePart
	} else {
		recurrenceRule = fmt.Sprintf("%s\nRRULE:FREQ=WEEKLY;BYDAY=%s;COUNT=1", dtstart, weekdayToRRuleDay(startAt.UTC().Weekday()))
	}
	return
}

// weeklyScheduleClassEvent renders a recurring weekly meeting pattern as the
// synthetic ProgramClassEvent the class lists format with
// services.FormatClassScheduleAndRoom. DTSTART is anchored on the next occurrence
// of the earliest scheduled meeting, so the rendered wall clock matches the
// pattern in the facility's own zone, and BYDAY lists every day the class meets.
func weeklyScheduleClassEvent(course liveCourse, loc *time.Location, now time.Time) (models.ProgramClassEvent, bool) {
	if len(course.weeklySchedule) == 0 {
		return models.ProgramClassEvent{}, false
	}
	if loc == nil {
		loc = time.UTC
	}

	byDay := make([]string, 0, len(course.weeklySchedule))
	var anchorDay time.Weekday
	var anchor meetingTime
	found := false
	// Walk Sunday-to-Saturday rather than ranging the map, so BYDAY and the anchor
	// are stable between calls.
	for day := time.Sunday; day <= time.Saturday; day++ {
		meetings := course.weeklySchedule[day]
		if len(meetings) == 0 {
			continue
		}
		byDay = append(byDay, weekdayToRRuleDay(day))
		if !found {
			anchorDay, anchor, found = day, meetings[0], true
		}
	}
	if !found {
		return models.ProgramClassEvent{}, false
	}

	local := now.In(loc)
	offset := (int(anchorDay) - int(local.Weekday()) + 7) % 7
	midnight := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, loc).AddDate(0, 0, offset)
	dtstart := midnight.Add(time.Duration(anchor.startMin) * time.Minute)

	return models.ProgramClassEvent{
		RecurrenceRule: fmt.Sprintf("DTSTART:%s\nRRULE:FREQ=WEEKLY;BYDAY=%s",
			dtstart.UTC().Format("20060102T150405Z"), strings.Join(byDay, ",")),
		Duration: (time.Duration(anchor.endMin-anchor.startMin) * time.Minute).String(),
	}, true
}

// fetchCanvasCoursesScheduleEvents returns a map of rawCourseID → synthetic
// ProgramClassEvent carrying a RecurrenceRule and Duration suitable for
// services.FormatClassScheduleAndRoom, mirroring how regular class events work.
// Canvas is read from its calendar events endpoint; providers that describe a
// recurring weekly pattern instead have no such endpoint, so their schedule is
// built from the pattern the course listing already carried.
func (srv *Server) fetchCanvasCoursesScheduleEvents(
	provider *models.ProviderPlatform,
	courses []liveCourse,
	loc *time.Location,
) map[uint]models.ProgramClassEvent {
	result := make(map[uint]models.ProgramClassEvent, len(courses))
	if len(courses) == 0 {
		return result
	}
	if !isCanvasProvider(provider) {
		now := time.Now()
		for _, course := range courses {
			if ev, ok := weeklyScheduleClassEvent(course, loc, now); ok {
				result[course.rawID] = ev
			}
		}
		return result
	}

	rawCourseIDs := make([]uint, 0, len(courses))
	for _, course := range courses {
		rawCourseIDs = append(rawCourseIDs, course.rawID)
	}

	today := time.Now()
	params := url.Values{}
	params.Set("start_date", today.Format("2006-01-02"))
	params.Set("end_date", today.AddDate(0, 0, 28).Format("2006-01-02"))
	params.Set("per_page", "100")
	params.Set("type", "event")
	for _, id := range rawCourseIDs {
		params.Add("context_codes[]", fmt.Sprintf("course_%d", id))
	}

	rawEvents, err := srv.fetchAllCanvasPages(context.Background(), provider, provider.BaseUrl+"/api/v1/calendar_events?"+params.Encode(), 0)
	if err != nil {
		log.WithError(err).Warnf("fetchCanvasCoursesScheduleEvents: failed to fetch events for provider %d", provider.ID)
		return result
	}

	for _, event := range rawEvents {
		contextCode, _ := event["context_code"].(string)
		if !strings.HasPrefix(contextCode, "course_") {
			continue
		}
		courseIDInt, err := strconv.ParseUint(strings.TrimPrefix(contextCode, "course_"), 10, 64)
		if err != nil {
			continue
		}
		rawID := uint(courseIDInt)
		if _, seen := result[rawID]; seen {
			continue // keep only the first (earliest) event per course
		}
		startAtStr, _ := event["start_at"].(string)
		endAtStr, _ := event["end_at"].(string)
		if startAtStr == "" || endAtStr == "" {
			continue
		}
		startAt, err := time.Parse(time.RFC3339, startAtStr)
		if err != nil {
			continue
		}
		endAt, err := time.Parse(time.RFC3339, endAtStr)
		if err != nil {
			continue
		}
		canvasRRule, _ := event["rrule"].(string)
		rruleStr, durStr := buildCanvasEventRRule(startAt, endAt, canvasRRule)
		result[rawID] = models.ProgramClassEvent{
			RecurrenceRule: rruleStr,
			Duration:       durStr,
		}
	}
	return result
}

// invalidateCanvasProgramCache deletes the NATS KV cache entries for the given Canvas
// provider so the next read recomputes enrollment counts. Both the global (scopedFacility=0)
// entry and the facility-scoped entry for the unlinked user's facility are purged.
// Non-Canvas providers and nil buckets are silently skipped.
func (srv *Server) invalidateCanvasProgramCache(providerID uint, userID int) {
	provider, err := srv.Db.GetProviderPlatformByID(int(providerID))
	if err != nil || !isLiveProgramProvider(provider) {
		return
	}
	kv := srv.buckets[CanvasPrograms]
	if kv == nil {
		return
	}
	globalKey := fmt.Sprintf("canvas_program_%d_0", providerID)
	if err := kv.Delete(globalKey); err != nil {
		log.WithError(err).Warnf("invalidateCanvasProgramCache: failed to delete key %s", globalKey)
	}
	user, err := srv.Db.GetUserByID(uint(userID))
	if err == nil && user.FacilityID != 0 {
		facilityKey := fmt.Sprintf("canvas_program_%d_%d", providerID, user.FacilityID)
		if err := kv.Delete(facilityKey); err != nil {
			log.WithError(err).Warnf("invalidateCanvasProgramCache: failed to delete key %s", facilityKey)
		}
	}
}

// countMappedCanvasEnrolleesPerFacility returns a map of facility_id → count of
// mapped users from that facility for a course. Enrollees are resolved through
// courseEnrollees, so a provider that reports them inline with its course listing
// costs no extra request here.
func (srv *Server) countMappedCanvasEnrolleesPerFacility(ctx context.Context, reader LiveProgramProvider, provider *models.ProviderPlatform, course liveCourse) map[uint]int64 {
	canvasUserIDs, err := courseEnrollees(ctx, reader, course)
	if err != nil {
		log.WithError(err).Warnf("countMappedCanvasEnrolleesPerFacility: failed to fetch enrollments for course %d", course.rawID)
		return nil
	}
	if len(canvasUserIDs) == 0 {
		return map[uint]int64{}
	}
	result, err := srv.Db.CountCanvasMappedEnrolleesPerFacility(provider.ID, canvasUserIDs)
	if err != nil {
		log.WithError(err).Warnf("countMappedCanvasEnrolleesPerFacility: failed to count enrollees for course %d", course.rawID)
		return nil
	}
	return result
}

// decodeCanvasClassID recovers (providerID, rawCourseID) from an encoded Canvas class ID.
func decodeCanvasClassID(classID uint) (providerID uint, rawCourseID uint) {
	remainder := classID - models.CanvasClassIDOffset
	return remainder / 1_000_000, remainder % 1_000_000
}

// encodeFacilityCanvasClassID packs (facilityID, providerID, rawCourseID) into a
// facility-scoped synthetic class ID so detail/enrollment handlers can extract the
// facility from the ID itself without relying on a URL parameter.
// Limits: facilityID 0–999, providerID 0–999, rawCourseID 0–999_999.
func encodeFacilityCanvasClassID(facilityID, providerID, rawCourseID uint) uint {
	return models.CanvasFacilityClassIDOffset + facilityID*1_000_000_000 + providerID*1_000_000 + rawCourseID
}

// decodeFacilityCanvasClassID is the reverse of encodeFacilityCanvasClassID.
func decodeFacilityCanvasClassID(classID uint) (facilityID, providerID, rawCourseID uint) {
	remainder := classID - models.CanvasFacilityClassIDOffset
	facilityID = remainder / 1_000_000_000
	remainder = remainder % 1_000_000_000
	providerID = remainder / 1_000_000
	rawCourseID = remainder % 1_000_000
	return
}

// resolveCanvasClassParts extracts (facilityID, providerID, rawCourseID) from any
// canvas class ID. For facility-scoped IDs the embedded facilityID is returned;
// for old-style IDs facilityID is 0 and the caller should fall back to JWT claims.
func resolveCanvasClassParts(classID uint) (facilityID, providerID, rawCourseID uint) {
	if classID >= models.CanvasFacilityClassIDOffset {
		return decodeFacilityCanvasClassID(classID)
	}
	p, c := decodeCanvasClassID(classID)
	return 0, p, c
}

// countMappedCanvasEnrolleesForFacility is like countMappedCanvasEnrollees but
// only counts users belonging to the given facility.
func (srv *Server) countMappedCanvasEnrolleesForFacility(ctx context.Context, reader LiveProgramProvider, provider *models.ProviderPlatform, course liveCourse, facilityID uint) int64 {
	canvasUserIDs, err := courseEnrollees(ctx, reader, course)
	if err != nil {
		log.WithError(err).Warnf("countMappedCanvasEnrolleesForFacility: failed to fetch enrollments for course %d", course.rawID)
		return 0
	}
	if len(canvasUserIDs) == 0 {
		return 0
	}
	count, err := srv.Db.CountCanvasMappedEnrolleesForFacility(provider.ID, canvasUserIDs, facilityID)
	if err != nil {
		log.WithError(err).Warnf("countMappedCanvasEnrolleesForFacility: failed to count enrollees for course %d", course.rawID)
		return 0
	}
	return count
}

// countMappedCanvasEnrollees returns how many of a course's students have a
// ProviderUserMapping. See countMappedCanvasEnrolleesPerFacility on how the
// enrollees are resolved.
func (srv *Server) countMappedCanvasEnrollees(ctx context.Context, reader LiveProgramProvider, provider *models.ProviderPlatform, course liveCourse) int64 {
	canvasUserIDs, err := courseEnrollees(ctx, reader, course)
	if err != nil {
		log.WithError(err).Warnf("countMappedCanvasEnrollees: failed to fetch enrollments for course %d", course.rawID)
		return 0
	}
	if len(canvasUserIDs) == 0 {
		return 0
	}
	count, err := srv.Db.CountCanvasMappedEnrollees(provider.ID, canvasUserIDs)
	if err != nil {
		log.WithError(err).Warnf("countMappedCanvasEnrollees: failed to count enrollees for course %d", course.rawID)
		return 0
	}
	return count
}

// computeCanvasCompletionRate fetches all enrollments across every course for
// the provider (active + completed states) and returns the percentage of mapped
// enrollments that have enrollment_state == "completed".
// ctx should carry a deadline — callers launching this in a goroutine must use
// context.WithTimeout to bound the N+1 Canvas API requests.
func (srv *Server) computeCanvasCompletionRate(ctx context.Context, provider *models.ProviderPlatform) float64 {
	// The per-course loop below builds Canvas enrollment URLs and bearer auth by
	// hand rather than going through the provider's transport, so running it for
	// any other provider only spends a request per course to get an error back.
	if !isCanvasProvider(provider) {
		return 0
	}
	reader, err := srv.newLiveProgramProvider(provider)
	if err != nil {
		return 0
	}
	listing, err := reader.ListCourses(ctx)
	if err != nil || len(listing.Courses) == 0 {
		return 0
	}

	type courseResult struct {
		allIDs       []string
		completedIDs []string
	}
	results := make([]courseResult, len(listing.Courses))
	var wg sync.WaitGroup
	var mu sync.Mutex
	sem := make(chan struct{}, 10)
	for i, course := range listing.Courses {
		rawCourseID := course.rawID
		wg.Add(1)
		sem <- struct{}{}
		go func(idx int, courseID uint) {
			defer wg.Done()
			defer func() { <-sem }()
			enrollURL := fmt.Sprintf(
				"%s/api/v1/courses/%d/enrollments?type[]=StudentEnrollment&state[]=active&state[]=completed&per_page=100",
				provider.BaseUrl, courseID,
			)
			enrollments, err := srv.fetchAllCanvasPages(ctx, provider, enrollURL, 0)
			if err != nil {
				return
			}
			var all, completed []string
			for _, e := range enrollments {
				u, ok := e["user"].(map[string]interface{})
				if !ok {
					continue
				}
				id, ok := u["id"].(float64)
				if !ok {
					continue
				}
				sid := fmt.Sprintf("%d", int(id))
				all = append(all, sid)
				if state, _ := e["enrollment_state"].(string); state == "completed" {
					completed = append(completed, sid)
				}
			}
			mu.Lock()
			results[idx] = courseResult{allIDs: all, completedIDs: completed}
			mu.Unlock()
		}(i, rawCourseID)
	}
	wg.Wait()

	var allIDs, completedIDs []string
	for _, r := range results {
		allIDs = append(allIDs, r.allIDs...)
		completedIDs = append(completedIDs, r.completedIDs...)
	}
	if len(allIDs) == 0 {
		return 0
	}

	totalMapped, err := srv.Db.CountCanvasMappedEnrollees(provider.ID, allIDs)
	if err != nil || totalMapped == 0 {
		return 0
	}
	var completedMapped int64
	if len(completedIDs) > 0 {
		completedMapped, _ = srv.Db.CountCanvasMappedEnrollees(provider.ID, completedIDs)
	}
	return float64(completedMapped) / float64(totalMapped) * 100
}

func (srv *Server) handleGetCanvasClassDetail(w http.ResponseWriter, r *http.Request, log sLog, classID uint) error {
	facilityIDFromID, providerID, rawCourseID := resolveCanvasClassParts(classID)
	provider, err := srv.Db.GetProviderPlatformByID(int(providerID))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if !isLiveProgramProvider(provider) {
		return newInvalidIdServiceError(fmt.Errorf("provider %d is not a live program provider", providerID), "class ID")
	}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	if !claims.hasFeatureAccess(models.ProviderAccess) {
		return newInvalidIdServiceError(fmt.Errorf("provider access disabled for provider %d", providerID), "class ID")
	}

	reader, err := srv.newLiveProgramProvider(provider)
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	entry, canvasTimezone, err := reader.GetCourse(r.Context(), rawCourseID)
	if err != nil {
		return newInternalServerServiceError(err, "failed to fetch course from "+providerDisplayName(provider))
	}
	programID := models.CanvasProgramIDOffset + providerID

	// Use the facility embedded in the ID; fall back to JWT claims for old-style IDs.
	facilityID := facilityIDFromID
	if facilityID == 0 {
		facilityID = srv.getQueryContext(r).FacilityID
	}
	var enrolled int64
	if facilityID != 0 {
		enrolled = srv.countMappedCanvasEnrolleesForFacility(r.Context(), reader, provider, entry, facilityID)
	} else {
		enrolled = srv.countMappedCanvasEnrollees(r.Context(), reader, provider, entry)
	}

	var facility *models.Facility
	if facilityID != 0 {
		if f, err := srv.Db.GetFacilityByID(int(facilityID)); err == nil {
			facility = f
		}
	}

	scheduleEvents := srv.fetchCanvasCoursesScheduleEvents(provider, []liveCourse{entry}, srv.facilityLocation(facilityID))
	events := []models.ProgramClassEvent{}
	if ev, ok := scheduleEvents[rawCourseID]; ok {
		events = []models.ProgramClassEvent{ev}
	}

	cls := models.ProgramClassCohort{
		DatabaseFields: models.DatabaseFields{ID: classID},
		ProgramID:      programID,
		FacilityID:     facilityID,
		Facility:       facility,
		ClassName:      entry.name, // see fetchCanvasClassesAllProviders
		Description:    entry.description,
		StartDt:        entry.startDt,
		EndDt:          entry.endDt,
		Status:         entry.status,
		Enrolled:       enrolled,
		IsCanvas:       true,
		Source:         providerSourceLabel(provider),
		CanvasTimezone: canvasTimezone,
		Program: &models.Program{
			DatabaseFields: models.DatabaseFields{ID: programID},
			Name:           "College - " + provider.Name,
		},
		Events:      events,
		Enrollments: []models.ProgramClassEnrollment{},
	}
	return writeJsonResponse(w, http.StatusOK, cls)
}

// fetchCanvasCourseTimezone returns the IANA timezone string for a Canvas course,
// falling back to empty string on any error so callers can use a default.
func (srv *Server) fetchCanvasCourseTimezone(provider *models.ProviderPlatform, rawCourseID uint) string {
	transport, err := srv.transportFor(provider)
	if err != nil {
		return ""
	}
	course, err := transport.fetchOne(context.Background(), provider, canvasCourseURL(provider, rawCourseID))
	if err != nil {
		return ""
	}
	tz, _ := course["time_zone"].(string)
	return tz
}

type canvasScheduleEvent struct {
	ID          uint      `json:"id"`
	Title       string    `json:"title"`
	StartAt     time.Time `json:"start_at"`
	EndAt       time.Time `json:"end_at"`
	IsCancelled bool      `json:"is_cancelled"`
	Timezone    string    `json:"timezone,omitempty"`
}

// expandWeeklySchedule turns a recurring weekly meeting pattern into concrete
// events across [start, end]. Providers that describe a weekly pattern rather
// than dated calendar events (Essential Ed) are rendered on the same calendar
// this way. Days outside the class's own open/close dates are skipped.
// The meeting times are wall-clock text with no zone attached -- an instructor
// typing "9:00 AM" means 9am where the class meets. loc is the facility's
// timezone, so the instants come out right for the people reading the calendar.
func expandWeeklySchedule(course liveCourse, start, end time.Time, loc *time.Location) []canvasScheduleEvent {
	events := []canvasScheduleEvent{}
	if len(course.weeklySchedule) == 0 {
		return events
	}
	if loc == nil {
		loc = time.UTC
	}
	for day := start; !day.After(end); day = day.AddDate(0, 0, 1) {
		if !course.startDt.IsZero() && day.Before(course.startDt.Truncate(24*time.Hour)) {
			continue
		}
		if course.endDt != nil && day.After(*course.endDt) {
			continue
		}
		for _, meeting := range course.weeklySchedule[day.Weekday()] {
			midnight := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, loc)
			events = append(events, canvasScheduleEvent{
				ID:       uint(len(events) + 1),
				Title:    course.name,
				StartAt:  midnight.Add(time.Duration(meeting.startMin) * time.Minute),
				EndAt:    midnight.Add(time.Duration(meeting.endMin) * time.Minute),
				Timezone: loc.String(),
			})
		}
	}
	return events
}

// facilityLocation returns a facility's timezone, falling back to UTC when the
// facility is unknown or its timezone will not load.
func (srv *Server) facilityLocation(facilityID uint) *time.Location {
	if facilityID == 0 {
		return time.UTC
	}
	facility, err := srv.Db.GetFacilityByID(int(facilityID))
	if err != nil {
		return time.UTC
	}
	loc, err := time.LoadLocation(facility.Timezone)
	if err != nil {
		return time.UTC
	}
	return loc
}

func (srv *Server) handleGetCanvasClassSchedule(w http.ResponseWriter, r *http.Request, log sLog) error {
	classID, err := strconv.Atoi(r.PathValue("cohort_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class_id")
	}
	if uint(classID) < models.CanvasClassIDOffset {
		return newInvalidIdServiceError(fmt.Errorf("class %d is not a canvas class", classID), "class_id")
	}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	if !claims.hasFeatureAccess(models.ProviderAccess) {
		return newInvalidIdServiceError(fmt.Errorf("provider access disabled for class %d", classID), "class_id")
	}
	facilityIDFromID, providerID, rawCourseID := resolveCanvasClassParts(uint(classID))
	provider, err := srv.Db.GetProviderPlatformByID(int(providerID))
	if err != nil {
		return newDatabaseServiceError(err)
	}

	now := time.Now()
	var start, end time.Time
	if sdStr := r.URL.Query().Get("start_date"); sdStr != "" {
		if t, err := time.Parse("2006-01-02", sdStr); err == nil {
			start = t
		}
	}
	if edStr := r.URL.Query().Get("end_date"); edStr != "" {
		if t, err := time.Parse("2006-01-02", edStr); err == nil {
			end = t
		}
	}
	if start.IsZero() || end.IsZero() {
		month := int(now.Month())
		year := now.Year()
		if m, err := strconv.Atoi(r.URL.Query().Get("month")); err == nil && m >= 1 && m <= 12 {
			month = m
		}
		if y, err := strconv.Atoi(r.URL.Query().Get("year")); err == nil && y > 2000 {
			year = y
		}
		start = time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
		end = start.AddDate(0, 1, -1)
	}

	// Providers that report a weekly meeting pattern instead of dated calendar
	// events have their pattern expanded across the requested range. Canvas has
	// real events, so it is read straight from the calendar endpoint.
	if !isCanvasProvider(provider) {
		reader, err := srv.newLiveProgramProvider(provider)
		if err != nil {
			return newInvalidIdServiceError(err, "class_id")
		}
		course, _, err := reader.GetCourse(r.Context(), rawCourseID)
		if err != nil {
			return newInternalServerServiceError(err, "failed to fetch course from "+providerDisplayName(provider))
		}
		args := srv.getQueryContext(r)
		facilityID := facilityIDFromID
		if facilityID == 0 {
			facilityID = args.FacilityID
		}
		events := expandWeeklySchedule(course, start, end, srv.facilityLocation(facilityID))
		args.Total = int64(len(events))
		return writePaginatedResponse(w, http.StatusOK, events, args.IntoMeta())
	}

	fetchURL := fmt.Sprintf(
		"%s/api/v1/calendar_events?context_codes[]=course_%d&start_date=%s&end_date=%s&per_page=100",
		provider.BaseUrl, rawCourseID,
		start.Format("2006-01-02"), end.Format("2006-01-02"),
	)

	raw, err := srv.fetchAllCanvasPages(r.Context(), provider, fetchURL, 0)
	if err != nil {
		return newInternalServerServiceError(err, "failed to fetch canvas events")
	}

	courseTimezone := srv.fetchCanvasCourseTimezone(provider, rawCourseID)

	events := make([]canvasScheduleEvent, 0, len(raw))
	for _, ev := range raw {
		startAtStr, _ := ev["start_at"].(string)
		endAtStr, _ := ev["end_at"].(string)
		if startAtStr == "" || endAtStr == "" {
			continue
		}
		startAt, err := time.Parse(time.RFC3339, startAtStr)
		if err != nil {
			continue
		}
		endAt, err := time.Parse(time.RFC3339, endAtStr)
		if err != nil {
			continue
		}
		title, _ := ev["title"].(string)
		isCancelled := ev["workflow_state"] == "deleted"
		var id uint
		if idFloat, ok := ev["id"].(float64); ok {
			id = encodeCanvasClassID(providerID, uint(idFloat))
		}
		events = append(events, canvasScheduleEvent{
			ID:          id,
			Title:       title,
			StartAt:     startAt,
			EndAt:       endAt,
			IsCancelled: isCancelled,
			Timezone:    courseTimezone,
		})
	}

	args := srv.getQueryContext(r)
	args.Total = int64(len(events))
	return writePaginatedResponse(w, http.StatusOK, events, args.IntoMeta())
}

// canvasEnrollmentRow mirrors database.EnrollmentDetails JSON shape so the
// frontend's ClassEnrollment type maps correctly.
type canvasEnrollmentRow struct {
	models.ProgramClassEnrollment
	NameFull     string `json:"name_full"`
	DocID        string `json:"doc_id"`
	ClassName    string `json:"class_name"`
	StartDt      string `json:"start_dt"`
	CompletionDt string `json:"completion_dt"`
}

func (srv *Server) handleGetCanvasClassEnrollments(w http.ResponseWriter, r *http.Request, log sLog, classID uint) error {
	facilityIDFromID, providerID, rawCourseID := resolveCanvasClassParts(classID)
	provider, err := srv.Db.GetProviderPlatformByID(int(providerID))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if !isLiveProgramProvider(provider) {
		return newInvalidIdServiceError(fmt.Errorf("provider %d is not a live program provider", providerID), "class ID")
	}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	if !claims.hasFeatureAccess(models.ProviderAccess) {
		return newInvalidIdServiceError(fmt.Errorf("provider access disabled for provider %d", providerID), "class ID")
	}

	// Canvas reports when each student joined, in the same call that lists them.
	// Other live providers only report the roster, so EnrolledAt stays nil rather
	// than being invented.
	var (
		canvasUserIDs   []string
		enrollmentDates map[string]*time.Time
	)
	if isCanvasProvider(provider) {
		canvasUserIDs, enrollmentDates, err = srv.fetchCanvasCourseEnrollmentData(provider, rawCourseID)
	} else {
		canvasUserIDs, err = srv.providerCourseEnrolleeIDs(provider, rawCourseID)
	}
	if err != nil {
		return newInternalServerServiceError(err, "failed to fetch enrollments from "+providerDisplayName(provider))
	}

	facilityID := facilityIDFromID
	if facilityID == 0 {
		facilityID = srv.getQueryContext(r).FacilityID
	}
	userMap, err := srv.fetchCanvasMappedUsers(providerID, canvasUserIDs, facilityID)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	rows := make([]canvasEnrollmentRow, 0, len(canvasUserIDs))
	for i, externalID := range canvasUserIDs {
		info, matched := userMap[externalID]
		if !matched {
			continue
		}
		rows = append(rows, canvasEnrollmentRow{
			ProgramClassEnrollment: models.ProgramClassEnrollment{
				DatabaseFields:   models.DatabaseFields{ID: uint(i + 1)},
				CohortID:         classID,
				UserID:           info.UserID,
				EnrollmentStatus: models.Enrolled,
				EnrolledAt:       enrollmentDates[externalID],
			},
			NameFull:  info.NameFirst + " " + info.NameLast,
			DocID:     info.DocID,
			ClassName: "",
		})
	}

	args := srv.getQueryContext(r)
	args.Total = int64(len(rows))
	return writePaginatedResponse(w, http.StatusOK, rows, args.IntoMeta())
}

// handleGetCanvasAtRiskStudents calls the Canvas student_summaries analytics
// endpoint and returns AttendanceFlag entries for students showing low engagement.
// A student is flagged if they trigger at least two of:
//   - page_views == 0 (never logged in)
//   - participations == 0 with assignments present (no submissions)
//   - missing / total > 0.30 (>30 % of assignments not submitted)
func (srv *Server) handleGetCanvasAtRiskStudents(w http.ResponseWriter, r *http.Request, classID uint) error {
	facilityIDFromID, providerID, rawCourseID := resolveCanvasClassParts(classID)
	provider, err := srv.Db.GetProviderPlatformByID(int(providerID))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if !isLiveProgramProvider(provider) {
		return newInvalidIdServiceError(fmt.Errorf("provider %d is not a live program provider", providerID), "class ID")
	}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	if !claims.hasFeatureAccess(models.ProviderAccess) {
		return newInvalidIdServiceError(fmt.Errorf("provider access disabled for provider %d", providerID), "class ID")
	}

	// Course analytics are Canvas-only; other live providers report no engagement
	// data, so there is nothing to flag rather than an error to report.
	if !isCanvasProvider(provider) {
		args := srv.getQueryContext(r)
		args.Total = 0
		return writePaginatedResponse(w, http.StatusOK, []models.AttendanceFlag{}, args.IntoMeta())
	}

	summaryURL := fmt.Sprintf("%s/api/v1/courses/%d/analytics/student_summaries", provider.BaseUrl, rawCourseID)
	summaries, err := srv.fetchAllCanvasPages(r.Context(), provider, summaryURL, 0)
	if err != nil {
		// Analytics may not be enabled on this Canvas instance — return empty rather than error.
		log.WithError(err).Warnf("canvas student_summaries unavailable for course %d, returning empty at-risk list", rawCourseID)
		args := srv.getQueryContext(r)
		args.Total = 0
		return writePaginatedResponse(w, http.StatusOK, []models.AttendanceFlag{}, args.IntoMeta())
	}

	canvasUserIDs := make([]string, 0, len(summaries))
	for _, s := range summaries {
		if id, ok := s["id"].(float64); ok {
			canvasUserIDs = append(canvasUserIDs, fmt.Sprintf("%d", int(id)))
		}
	}

	facilityID := facilityIDFromID
	if facilityID == 0 {
		facilityID = srv.getQueryContext(r).FacilityID
	}
	userMap, err := srv.fetchCanvasMappedUsers(providerID, canvasUserIDs, facilityID)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	flags := make([]models.AttendanceFlag, 0)
	for _, s := range summaries {
		canvasIDStr := ""
		if id, ok := s["id"].(float64); ok {
			canvasIDStr = fmt.Sprintf("%d", int(id))
		}
		info, matched := userMap[canvasIDStr]
		if !matched {
			continue
		}

		pageViews, participations := 0, 0
		if v, ok := s["page_views"].(float64); ok {
			pageViews = int(v)
		}
		if v, ok := s["participations"].(float64); ok {
			participations = int(v)
		}

		total, missing, onTime, late := 0, 0, 0, 0
		if td, ok := s["tardiness_breakdown"].(map[string]interface{}); ok {
			if v, ok := td["total"].(float64); ok {
				total = int(v)
			}
			if v, ok := td["missing"].(float64); ok {
				missing = int(v)
			}
			if v, ok := td["on_time"].(float64); ok {
				onTime = int(v)
			}
			if v, ok := td["late"].(float64); ok {
				late = int(v)
			}
		}

		riskScore := 0
		if pageViews == 0 {
			riskScore++
		}
		if total > 0 && participations == 0 {
			riskScore++
		}
		if total > 0 && float64(missing)/float64(total) > 0.30 {
			riskScore++
		}
		if riskScore < 2 {
			continue
		}

		submitted := onTime + late
		attendanceRate := 0
		if total > 0 {
			attendanceRate = submitted * 100 / total
		}
		flagType := models.MultipleAbsences
		if pageViews == 0 || participations == 0 {
			flagType = models.NoAttendance
		}

		flags = append(flags, models.AttendanceFlag{
			NameFirst:           info.NameFirst,
			NameLast:            info.NameLast,
			DocID:               info.DocID,
			FlagType:            flagType,
			UserID:              info.UserID,
			TotalSessions:       total,
			AttendedSessions:    submitted,
			MissedSessions:      missing,
			AttendanceRate:      attendanceRate,
			ConsecutiveAbsences: 0,
		})
	}

	args := srv.getQueryContext(r)
	args.Total = int64(len(flags))
	return writePaginatedResponse(w, http.StatusOK, flags, args.IntoMeta())
}
