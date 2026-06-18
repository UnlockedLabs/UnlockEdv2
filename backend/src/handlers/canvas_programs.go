package handlers

import (
	"UnlockEdv2/src/models"
	"UnlockEdv2/src/services"
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
	Program     models.ProgramsOverviewTable
	LastUpdated time.Time
}

// canvasCourseEntry holds parsed metadata for a single Canvas course.
type canvasCourseEntry struct {
	encodedID   uint
	rawID       uint
	name        string
	description string
	startDt     time.Time
	endDt       *time.Time
	status      models.ClassStatus
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
func parseCanvasCourse(course map[string]interface{}, providerID uint, now time.Time) (canvasCourseEntry, bool) {
	idFloat, ok := course["id"].(float64)
	if !ok {
		return canvasCourseEntry{}, false
	}
	rawID := uint(idFloat)
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
	return canvasCourseEntry{
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
	enrollments, err := srv.fetchAllCanvasPages(provider, enrollURL, 0)
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

// getCanvasProviderPrograms returns one synthetic ProgramsOverviewTable entry per
// enabled Canvas provider platform. Results are served from NATS KV when fresh
// (< 5 min old) and populated via a live Canvas API call on cache miss.
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
		if !isCanvasProvider(&provider) {
			continue
		}
		cacheKey := fmt.Sprintf("canvas_program_%d_%d", provider.ID, scopedFacilityID)

		if kv != nil {
			if entry, err := kv.Get(cacheKey); err == nil {
				var cached CachedCanvasProgram
				if json.Unmarshal(entry.Value(), &cached) == nil {
					if cached.LastUpdated.Add(5 * time.Minute).After(time.Now()) {
						result = append(result, cached.Program)
						continue
					}
				}
			}
		}

		program, err := srv.fetchCanvasProviderProgram(&provider, scopedFacilityID)
		if err != nil {
			log.WithError(err).Warnf("failed to fetch canvas program for provider %d, skipping", provider.ID)
			continue
		}

		if kv != nil {
			if data, err := json.Marshal(CachedCanvasProgram{Program: program, LastUpdated: time.Now()}); err == nil {
				if _, err := kv.Put(cacheKey, data); err != nil {
					log.WithError(err).Warn("failed to store canvas program in NATS KV cache")
				}
			}
		}
		result = append(result, program)
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
	coursesURL := provider.BaseUrl + "/api/v1/accounts/" + provider.AccountID + "/courses?per_page=100"
	courses, err := srv.fetchAllCanvasPages(provider, coursesURL, 0)
	if err != nil {
		return models.ProgramsOverviewTable{}, fmt.Errorf("canvas API error for provider %d: %w", provider.ID, err)
	}

	var totalClasses, activeClasses int64
	now := time.Now()
	totalClasses = int64(len(courses))

	type courseEntry struct {
		rawID    uint
		isActive bool
	}
	entries := make([]courseEntry, 0, len(courses))
	for _, course := range courses {
		idFloat, ok := course["id"].(float64)
		if !ok {
			continue
		}
		rawID := uint(idFloat)
		isActive := true
		if endAt, ok := course["end_at"].(string); ok && endAt != "" {
			if t, err := time.Parse("2006-01-02T15:04:05Z", endAt); err == nil {
				isActive = t.After(now)
			}
		}
		if isActive {
			activeClasses++
		}
		entries = append(entries, courseEntry{rawID: rawID, isActive: isActive})
	}

	// Sum per-course mapped enrollee counts concurrently, scoped to facility when set.
	// This matches the calculation used on the program detail page.
	var activeEnrollments int64
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, e := range entries {
		if !e.isActive {
			continue
		}
		wg.Add(1)
		go func(rawID uint) {
			defer wg.Done()
			var n int64
			if facilityID != 0 {
				n = srv.countMappedCanvasEnrolleesForFacility(provider, rawID, facilityID)
			} else {
				n = srv.countMappedCanvasEnrollees(provider, rawID)
			}
			mu.Lock()
			activeEnrollments += n
			mu.Unlock()
		}(e.rawID)
	}
	wg.Wait()

	programID := models.CanvasProgramIDOffset + provider.ID
	return models.ProgramsOverviewTable{
		ProgramID:              programID,
		ProgramName:            provider.Name,
		Description:            "Courses pulled live from Canvas connection: " + provider.Name,
		TotalEnrollments:       &activeEnrollments,
		TotalActiveEnrollments: &activeEnrollments,
		TotalClasses:           &totalClasses,
		TotalActiveClasses:     &activeClasses,
		Types:                  "College",
		Status:                 true,
		Source:                 "canvas",
	}, nil
}

// fetchAllCanvasPages fetches pages from a Canvas API endpoint and returns the combined results.
// max limits the total number of items returned; 0 means no limit (fetch all pages).
func (srv *Server) fetchAllCanvasPages(provider *models.ProviderPlatform, startURL string, max int) ([]map[string]interface{}, error) {
	var all []map[string]interface{}
	for pageURL := startURL; pageURL != ""; {
		req, err := http.NewRequest("GET", pageURL, nil)
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
			resp.Body.Close()
			return nil, fmt.Errorf("canvas API returned %d", resp.StatusCode)
		}
		var page []map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&page); err != nil {
			resp.Body.Close()
			return nil, err
		}
		pageURL = NextPageURL(resp.Header.Get("Link"))
		resp.Body.Close()
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
) ([]models.FacilityProgramClassEvent, error) {
	// Step 1: fetch all courses for this provider (paginated)
	coursesURL := provider.BaseUrl + "/api/v1/accounts/" + provider.AccountID + "/courses?per_page=100"
	courses, err := srv.fetchAllCanvasPages(provider, coursesURL, 0)
	if err != nil {
		return nil, fmt.Errorf("fetching courses for provider %d: %w", provider.ID, err)
	}

	if len(courses) == 0 {
		return []models.FacilityProgramClassEvent{}, nil
	}

	courseTimezones := buildCourseTimezoneMap(courses)

	// Step 2: build context_codes[] query params using url.Values so brackets are encoded
	params := url.Values{}
	params.Set("start_date", start.Format("2006-01-02"))
	params.Set("end_date", end.Format("2006-01-02"))
	params.Set("per_page", "100")
	for _, course := range courses {
		if idFloat, ok := course["id"].(float64); ok {
			params.Add("context_codes[]", fmt.Sprintf("course_%d", int(idFloat)))
		}
	}
	rawEvents, err := srv.fetchAllCanvasPages(provider, provider.BaseUrl+"/api/v1/calendar_events?"+params.Encode(), 0)
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
		ev.ClassID = classID
		events = append(events, ev)
	}
	return events, nil
}

// fetchCanvasClassesAllProviders returns a ProgramClass for every Canvas course
// across all active Canvas provider platforms. Failures per-provider are logged
// and skipped so a single unreachable provider doesn't break the response.
// facilityID must be non-nil and non-zero; for the statewide (all-facilities) case
// use fetchCanvasClassesAllProvidersAllFacilities instead.
func (srv *Server) fetchCanvasClassesAllProviders(facilityID *uint) ([]models.ProgramClass, error) {
	providers, err := srv.Db.GetAllActiveProviderPlatforms()
	if err != nil {
		return nil, err
	}
	now := time.Now()
	var facility *models.Facility
	if facilityID != nil && *facilityID != 0 {
		if f, err := srv.Db.GetFacilityByID(int(*facilityID)); err == nil {
			facility = f
		}
	}
	var result []models.ProgramClass
	for _, provider := range providers {
		if !isCanvasProvider(&provider) {
			continue
		}
		programID := models.CanvasProgramIDOffset + provider.ID
		apiURL := provider.BaseUrl + "/api/v1/accounts/" + provider.AccountID + "/courses?per_page=100"
		courses, err := srv.fetchAllCanvasPages(&provider, apiURL, 0)
		if err != nil {
			log.WithError(err).Warnf("failed to fetch canvas courses for provider %d, skipping", provider.ID)
			continue
		}
		entries := make([]canvasCourseEntry, 0, len(courses))
		for _, course := range courses {
			entry, ok := parseCanvasCourse(course, provider.ID, now)
			if !ok {
				continue
			}
			entries = append(entries, entry)
		}
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
				n := srv.countMappedCanvasEnrolleesForFacility(&provider, entries[idx].rawID, *facilityID)
				mu.Lock()
				counts[idx] = n
				mu.Unlock()
			}(i)
		}
		wg.Wait()
		for i, entry := range entries {
			result = append(result, models.ProgramClass{
				DatabaseFields: models.DatabaseFields{ID: encodeFacilityCanvasClassID(*facilityID, provider.ID, entry.rawID)},
				ProgramID:      programID,
				FacilityID:     *facilityID,
				Facility:       facility,
				Name:           entry.name,
				Description:    entry.description,
				StartDt:        entry.startDt,
				EndDt:          entry.endDt,
				Status:         entry.status,
				Enrolled:       counts[i],
				IsCanvas:       true,
				Program: &models.Program{
					DatabaseFields: models.DatabaseFields{ID: programID},
					Name:           "College - " + provider.Name,
				},
			})
		}
	}
	return result, nil
}

// fetchCanvasClassesAllProvidersAllFacilities returns one ProgramClass per
// (facility × Canvas course) with facility-scoped IDs. Used by the statewide
// classes index when facility=all so every returned class has a navigable,
// facility-scoped ID.
func (srv *Server) fetchCanvasClassesAllProvidersAllFacilities() ([]models.ProgramClass, error) {
	providers, err := srv.Db.GetAllActiveProviderPlatforms()
	if err != nil {
		return nil, err
	}
	facilities, err := srv.Db.GetAllFacilitiesOrdered()
	if err != nil {
		return nil, err
	}
	now := time.Now()
	var result []models.ProgramClass
	for _, provider := range providers {
		if !isCanvasProvider(&provider) {
			continue
		}
		programID := models.CanvasProgramIDOffset + provider.ID
		apiURL := provider.BaseUrl + "/api/v1/accounts/" + provider.AccountID + "/courses?per_page=100"
		courses, err := srv.fetchAllCanvasPages(&provider, apiURL, 0)
		if err != nil {
			log.WithError(err).Warnf("failed to fetch canvas courses for provider %d, skipping", provider.ID)
			continue
		}
		entries := make([]canvasCourseEntry, 0, len(courses))
		for _, course := range courses {
			entry, ok := parseCanvasCourse(course, provider.ID, now)
			if !ok {
				continue
			}
			entries = append(entries, entry)
		}
		// Fetch per-facility enrollment counts for each course concurrently.
		// countMappedCanvasEnrolleesPerFacility makes one Canvas HTTP call and
		// one DB query per course, returning counts for all facilities at once,
		// so this is O(courses) HTTP calls rather than O(courses × facilities).
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
				counts := srv.countMappedCanvasEnrolleesPerFacility(&provider, entries[idx].rawID)
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
				result = append(result, models.ProgramClass{
					DatabaseFields: models.DatabaseFields{ID: encodeFacilityCanvasClassID(facility.ID, provider.ID, entry.rawID)},
					ProgramID:      programID,
					FacilityID:     facility.ID,
					Facility:       &facilityPtr,
					Name:           entry.name,
					Description:    entry.description,
					StartDt:        entry.startDt,
					EndDt:          entry.endDt,
					Status:         entry.status,
					Enrolled:       enrolled,
					IsCanvas:       true,
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
func (srv *Server) appendCanvasEventsForFacility(dtRng *models.DateRange) ([]models.FacilityProgramClassEvent, error) {
	providers, err := srv.Db.GetAllActiveProviderPlatforms()
	if err != nil {
		return nil, err
	}
	var result []models.FacilityProgramClassEvent
	for _, provider := range providers {
		if !isCanvasProvider(&provider) {
			continue
		}
		evs, err := srv.fetchCanvasCalendarEvents(&provider, dtRng.Start, dtRng.End)
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
	if !isCanvasProvider(provider) {
		return newInvalidIdServiceError(fmt.Errorf("provider %d is not a canvas type", connectionID), "program ID")
	}
	prog, err := srv.fetchCanvasProviderProgram(provider, srv.getQueryContext(r).FacilityID)
	if err != nil {
		return newInternalServerServiceError(err, "failed to fetch canvas program")
	}
	totalEnrollments := 0
	if prog.TotalEnrollments != nil {
		totalEnrollments = int(*prog.TotalEnrollments)
	}
	activeEnrollments := 0
	if prog.TotalActiveEnrollments != nil {
		activeEnrollments = int(*prog.TotalActiveEnrollments)
	}
	// Completion rate for Canvas programs is expensive to compute (N+1 Canvas API
	// calls). The frontend falls back to computing it from the classes endpoint data,
	// so returning 0 here is safe and avoids proxy timeouts on slow Canvas instances.
	overview := models.ProgramOverviewResponse{
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
		CompletionRate:         0,
		ActiveClassFacilityIDs: []int{},
	}
	return writeJsonResponse(w, http.StatusOK, overview)
}

func (srv *Server) handleGetCanvasClasses(w http.ResponseWriter, r *http.Request, log sLog, programID uint) error {
	connectionID := programID - models.CanvasProgramIDOffset
	provider, err := srv.Db.GetProviderPlatformByID(int(connectionID))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if !isCanvasProvider(provider) {
		return newInvalidIdServiceError(fmt.Errorf("provider %d is not a canvas type", connectionID), "program ID")
	}

	facilityID := srv.getQueryContext(r).FacilityID
	if r.URL.Query().Get("all") == "true" || facilityID == 0 {
		return srv.handleGetCanvasClassesByFacility(w, r, provider, programID, connectionID)
	}

	coursesURL := provider.BaseUrl + "/api/v1/accounts/" + provider.AccountID + "/courses?per_page=100"
	courses, err := srv.fetchAllCanvasPages(provider, coursesURL, 0)
	if err != nil {
		return newInternalServerServiceError(err, "failed to fetch canvas courses")
	}

	courseTimezones := buildCourseTimezoneMap(courses)

	now := time.Now()
	classes := make([]models.ProgramClassDetail, 0, len(courses))
	for _, course := range courses {
		entry, ok := parseCanvasCourse(course, connectionID, now)
		if !ok {
			continue
		}
		classes = append(classes, models.ProgramClassDetail{
			ProgramClass: models.ProgramClass{
				DatabaseFields: models.DatabaseFields{ID: entry.encodedID},
				ProgramID:      programID,
				FacilityID:     0,
				Name:           entry.name,
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
			_, rawID := decodeCanvasClassID(classes[idx].ProgramClass.ID)
			var n int64
			if facilityID != 0 {
				n = srv.countMappedCanvasEnrolleesForFacility(provider, rawID, facilityID)
			} else {
				n = srv.countMappedCanvasEnrollees(provider, rawID)
			}
			mu.Lock()
			counts[classes[idx].ProgramClass.ID] = n
			mu.Unlock()
		}(i)
	}
	wg.Wait()

	for i := range classes {
		n := counts[classes[i].ProgramClass.ID]
		classes[i].ProgramClass.Enrolled = n
		classes[i].Enrolled = int(n)
	}

	// Batch-fetch upcoming calendar events to populate schedule info.
	rawIDs := make([]uint, len(classes))
	for i, cls := range classes {
		_, rawIDs[i] = decodeCanvasClassID(cls.ProgramClass.ID)
	}
	scheduleEvents := srv.fetchCanvasCoursesScheduleEvents(provider, rawIDs)
	facilityTimezone := srv.getQueryContext(r).Timezone
	for i, cls := range classes {
		_, rawID := decodeCanvasClassID(cls.ProgramClass.ID)
		if ev, ok := scheduleEvents[rawID]; ok {
			classes[i].ProgramClass.Events = []models.ProgramClassEvent{ev}
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
			_, rawID := decodeCanvasClassID(classes[i].ProgramClass.ID)
			classes[i].ProgramClass.ID = encodeFacilityCanvasClassID(facilityID, connectionID, rawID)
			classes[i].ProgramClass.FacilityID = facilityID
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
	canvasURL := provider.BaseUrl + "/api/v1/accounts/" + provider.AccountID + "/courses?per_page=100"
	courses, err := srv.fetchAllCanvasPages(provider, canvasURL, 0)
	if err != nil {
		return newInternalServerServiceError(err, "failed to fetch canvas courses")
	}

	courseTimezones := buildCourseTimezoneMap(courses)

	now := time.Now()
	entries := make([]canvasCourseEntry, 0, len(courses))
	for _, course := range courses {
		entry, ok := parseCanvasCourse(course, connectionID, now)
		if !ok {
			continue
		}
		entries = append(entries, entry)
	}

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
			rawID := entries[idx].rawID
			counts := srv.countMappedCanvasEnrolleesPerFacility(provider, rawID)
			mu.Lock()
			facilityCounts[idx] = counts
			mu.Unlock()
		}(i)
	}
	wg.Wait()

	// Batch-fetch upcoming calendar events for all courses to derive schedule strings.
	rawIDs := make([]uint, len(entries))
	for i, e := range entries {
		rawIDs[i] = e.rawID
	}
	scheduleEvents := srv.fetchCanvasCoursesScheduleEvents(provider, rawIDs)
	facilityTimezone := srv.getQueryContext(r).Timezone

	// Build one row per (facility × course).
	classes := make([]models.ProgramClassDetail, 0, len(facilities)*len(entries))
	for _, facility := range facilities {
		for i, entry := range entries {
			enrolled := int64(0)
			if facilityCounts[i] != nil {
				enrolled = facilityCounts[i][facility.ID]
			}
			var sched string
			var evSlice []models.ProgramClassEvent
			if ev, ok := scheduleEvents[entry.rawID]; ok {
				evSlice = []models.ProgramClassEvent{ev}
				tz := courseTimezones[entry.rawID]
				if tz == "" {
					tz = facilityTimezone
				}
				sched, _ = services.FormatClassScheduleAndRoom(evSlice, tz)
			}
			classes = append(classes, models.ProgramClassDetail{
				ProgramClass: models.ProgramClass{
					DatabaseFields: models.DatabaseFields{ID: encodeFacilityCanvasClassID(facility.ID, connectionID, entry.rawID)},
					ProgramID:      programID,
					FacilityID:     facility.ID,
					Name:           entry.name,
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

// fetchCanvasCoursesScheduleEvents batch-fetches upcoming calendar events for the given
// raw Canvas course IDs and returns a map of rawCourseID → synthetic ProgramClassEvent.
// The synthetic event carries a RecurrenceRule and Duration suitable for passing to
// services.FormatClassScheduleAndRoom, mirroring how regular class events work.
func (srv *Server) fetchCanvasCoursesScheduleEvents(
	provider *models.ProviderPlatform,
	rawCourseIDs []uint,
) map[uint]models.ProgramClassEvent {
	result := make(map[uint]models.ProgramClassEvent, len(rawCourseIDs))
	if len(rawCourseIDs) == 0 {
		return result
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

	rawEvents, err := srv.fetchAllCanvasPages(provider, provider.BaseUrl+"/api/v1/calendar_events?"+params.Encode(), 0)
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
	if err != nil || !isCanvasProvider(provider) {
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

// countMappedCanvasEnrolleesPerFacility fetches active enrollments for a Canvas course
// and returns a map of facility_id → count of mapped users from that facility.
func (srv *Server) countMappedCanvasEnrolleesPerFacility(provider *models.ProviderPlatform, rawCourseID uint) map[uint]int64 {
	canvasUserIDs, err := srv.fetchCanvasCourseEnrolleeIDs(provider, rawCourseID)
	if err != nil {
		log.WithError(err).Warnf("countMappedCanvasEnrolleesPerFacility: failed to fetch enrollments for course %d", rawCourseID)
		return nil
	}
	if len(canvasUserIDs) == 0 {
		return map[uint]int64{}
	}
	result, err := srv.Db.CountCanvasMappedEnrolleesPerFacility(provider.ID, canvasUserIDs)
	if err != nil {
		log.WithError(err).Warnf("countMappedCanvasEnrolleesPerFacility: failed to count enrollees for course %d", rawCourseID)
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
func (srv *Server) countMappedCanvasEnrolleesForFacility(provider *models.ProviderPlatform, rawCourseID uint, facilityID uint) int64 {
	canvasUserIDs, err := srv.fetchCanvasCourseEnrolleeIDs(provider, rawCourseID)
	if err != nil {
		log.WithError(err).Warnf("countMappedCanvasEnrolleesForFacility: failed to fetch enrollments for course %d", rawCourseID)
		return 0
	}
	if len(canvasUserIDs) == 0 {
		return 0
	}
	count, err := srv.Db.CountCanvasMappedEnrolleesForFacility(provider.ID, canvasUserIDs, facilityID)
	if err != nil {
		log.WithError(err).Warnf("countMappedCanvasEnrolleesForFacility: failed to count enrollees for course %d", rawCourseID)
		return 0
	}
	return count
}

// countMappedCanvasEnrollees fetches active student enrollments for a Canvas
// course and returns how many of those students have a ProviderUserMapping.
func (srv *Server) countMappedCanvasEnrollees(provider *models.ProviderPlatform, rawCourseID uint) int64 {
	canvasUserIDs, err := srv.fetchCanvasCourseEnrolleeIDs(provider, rawCourseID)
	if err != nil {
		log.WithError(err).Warnf("countMappedCanvasEnrollees: failed to fetch enrollments for course %d", rawCourseID)
		return 0
	}
	if len(canvasUserIDs) == 0 {
		return 0
	}
	count, err := srv.Db.CountCanvasMappedEnrollees(provider.ID, canvasUserIDs)
	if err != nil {
		log.WithError(err).Warnf("countMappedCanvasEnrollees: failed to count enrollees for course %d", rawCourseID)
		return 0
	}
	return count
}

// computeCanvasCompletionRate fetches all enrollments across every course for
// the provider (active + completed states) and returns the percentage of mapped
// enrollments that have enrollment_state == "completed".
func (srv *Server) computeCanvasCompletionRate(provider *models.ProviderPlatform) float64 {
	coursesURL := provider.BaseUrl + "/api/v1/accounts/" + provider.AccountID + "/courses?per_page=100"
	courses, err := srv.fetchAllCanvasPages(provider, coursesURL, 0)
	if err != nil || len(courses) == 0 {
		return 0
	}

	type courseResult struct {
		allIDs       []string
		completedIDs []string
	}
	results := make([]courseResult, len(courses))
	var wg sync.WaitGroup
	var mu sync.Mutex
	sem := make(chan struct{}, 10)
	for i, course := range courses {
		courseIDFloat, ok := course["id"].(float64)
		if !ok {
			continue
		}
		rawCourseID := uint(courseIDFloat)
		wg.Add(1)
		sem <- struct{}{}
		go func(idx int, courseID uint) {
			defer wg.Done()
			defer func() { <-sem }()
			enrollURL := fmt.Sprintf(
				"%s/api/v1/courses/%d/enrollments?type[]=StudentEnrollment&state[]=active&state[]=completed&per_page=100",
				provider.BaseUrl, courseID,
			)
			enrollments, err := srv.fetchAllCanvasPages(provider, enrollURL, 0)
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
	if !isCanvasProvider(provider) {
		return newInvalidIdServiceError(fmt.Errorf("provider %d is not a canvas type", providerID), "class ID")
	}

	courseURL := fmt.Sprintf("%s/api/v1/courses/%d", provider.BaseUrl, rawCourseID)
	req, err := http.NewRequest("GET", courseURL, nil)
	if err != nil {
		return newInternalServerServiceError(err, "failed to build canvas request")
	}
	req.Header.Add("Authorization", "Bearer "+provider.AccessKey)
	req.Header.Add("Accept", "application/json")

	resp, err := srv.Client.Do(req)
	if err != nil {
		return newInternalServerServiceError(err, "failed to reach canvas")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return newInternalServerServiceError(
			fmt.Errorf("canvas returned %d", resp.StatusCode),
			"canvas API error",
		)
	}

	var course map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&course); err != nil {
		return newInternalServerServiceError(err, "failed to decode canvas course")
	}

	entry, _ := parseCanvasCourse(course, providerID, time.Now())
	canvasTimezone, _ := course["time_zone"].(string)
	programID := models.CanvasProgramIDOffset + providerID

	// Use the facility embedded in the ID; fall back to JWT claims for old-style IDs.
	facilityID := facilityIDFromID
	if facilityID == 0 {
		facilityID = srv.getQueryContext(r).FacilityID
	}
	var enrolled int64
	if facilityID != 0 {
		enrolled = srv.countMappedCanvasEnrolleesForFacility(provider, rawCourseID, facilityID)
	} else {
		enrolled = srv.countMappedCanvasEnrollees(provider, rawCourseID)
	}

	var facility *models.Facility
	if facilityID != 0 {
		if f, err := srv.Db.GetFacilityByID(int(facilityID)); err == nil {
			facility = f
		}
	}

	scheduleEvents := srv.fetchCanvasCoursesScheduleEvents(provider, []uint{rawCourseID})
	var events []models.ProgramClassEvent
	if ev, ok := scheduleEvents[rawCourseID]; ok {
		events = []models.ProgramClassEvent{ev}
	} else {
		events = []models.ProgramClassEvent{}
	}

	cls := models.ProgramClass{
		DatabaseFields: models.DatabaseFields{ID: classID},
		ProgramID:      programID,
		FacilityID:     facilityID,
		Facility:       facility,
		Name:           entry.name,
		Description:    entry.description,
		StartDt:        entry.startDt,
		EndDt:          entry.endDt,
		Status:         entry.status,
		Enrolled:       enrolled,
		IsCanvas:       true,
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
	courseURL := fmt.Sprintf("%s/api/v1/courses/%d", provider.BaseUrl, rawCourseID)
	req, err := http.NewRequest("GET", courseURL, nil)
	if err != nil {
		return ""
	}
	req.Header.Add("Authorization", "Bearer "+provider.AccessKey)
	req.Header.Add("Accept", "application/json")
	resp, err := srv.Client.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		if resp != nil {
			resp.Body.Close()
		}
		return ""
	}
	defer resp.Body.Close()
	var course map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&course); err != nil {
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

func (srv *Server) handleGetCanvasClassSchedule(w http.ResponseWriter, r *http.Request, log sLog) error {
	classID, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class_id")
	}
	if uint(classID) < models.CanvasClassIDOffset {
		return newInvalidIdServiceError(fmt.Errorf("class %d is not a canvas class", classID), "class_id")
	}
	_, providerID, rawCourseID := resolveCanvasClassParts(uint(classID))
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

	fetchURL := fmt.Sprintf(
		"%s/api/v1/calendar_events?context_codes[]=course_%d&start_date=%s&end_date=%s&per_page=100",
		provider.BaseUrl, rawCourseID,
		start.Format("2006-01-02"), end.Format("2006-01-02"),
	)

	raw, err := srv.fetchAllCanvasPages(provider, fetchURL, 0)
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
	if !isCanvasProvider(provider) {
		return newInvalidIdServiceError(fmt.Errorf("provider %d is not a canvas type", providerID), "class ID")
	}

	canvasUserIDs, enrollmentDates, err := srv.fetchCanvasCourseEnrollmentData(provider, rawCourseID)
	if err != nil {
		return newInternalServerServiceError(err, "failed to fetch canvas enrollments")
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
				ClassID:          classID,
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
	if !isCanvasProvider(provider) {
		return newInvalidIdServiceError(fmt.Errorf("provider %d is not a canvas type", providerID), "class ID")
	}

	summaryURL := fmt.Sprintf("%s/api/v1/courses/%d/analytics/student_summaries", provider.BaseUrl, rawCourseID)
	summaries, err := srv.fetchAllCanvasPages(provider, summaryURL, 0)
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
