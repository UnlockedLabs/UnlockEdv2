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

// getCanvasProviderPrograms returns one synthetic ProgramsOverviewTable entry per
// enabled Canvas provider platform. Results are served from NATS KV when fresh
// (< 5 min old) and populated via a live Canvas API call on cache miss.
func (srv *Server) getCanvasProviderPrograms() ([]models.ProgramsOverviewTable, error) {
	providers, err := srv.Db.GetAllActiveProviderPlatforms()
	if err != nil {
		return nil, err
	}
	kv := srv.buckets[CanvasPrograms]
	if kv == nil {
		log.Warn("canvas_programs NATS bucket is nil, skipping cache")
	}
	var result []models.ProgramsOverviewTable

	for _, provider := range providers {
		if provider.Type != models.CanvasOSS && provider.Type != models.CanvasCloud {
			continue
		}
		cacheKey := fmt.Sprintf("canvas_program_%d", provider.ID)

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

		program, err := srv.fetchCanvasProviderProgram(&provider)
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
// and builds the synthetic program entry.
func (srv *Server) fetchCanvasProviderProgram(provider *models.ProviderPlatform) (models.ProgramsOverviewTable, error) {
	coursesURL := provider.BaseUrl + "/api/v1/accounts/" + provider.AccountID + "/courses?per_page=100"
	courses, err := srv.fetchAllCanvasPages(provider, coursesURL, 0)
	if err != nil {
		return models.ProgramsOverviewTable{}, fmt.Errorf("canvas API error for provider %d: %w", provider.ID, err)
	}

	var totalClasses, activeClasses int64
	now := time.Now()
	totalClasses = int64(len(courses))

	for _, course := range courses {
		isActive := true
		if endAt, ok := course["end_at"].(string); ok && endAt != "" {
			if t, err := time.Parse("2006-01-02T15:04:05Z", endAt); err == nil {
				isActive = t.After(now)
			}
		}
		if isActive {
			activeClasses++
		}
	}

	var totalEnrollments int64
	srv.Db.Model(&models.ProviderUserMapping{}).
		Where("provider_platform_id = ?", provider.ID).
		Count(&totalEnrollments)

	programID := models.CanvasProgramIDOffset + provider.ID
	return models.ProgramsOverviewTable{
		ProgramID:              programID,
		ProgramName:            provider.Name,
		Description:            "Courses pulled live from Canvas connection: " + provider.Name,
		TotalEnrollments:       &totalEnrollments,
		TotalActiveEnrollments: &totalEnrollments,
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
		pageURL = nextPageURL(resp.Header.Get("Link"))
		resp.Body.Close()
		all = append(all, page...)
		if max > 0 && len(all) >= max {
			break
		}
	}
	return all, nil
}

// nextPageURL parses a Canvas Link header and returns the URL for rel="next",
// or an empty string if there is no next page.
func nextPageURL(header string) string {
	for _, part := range strings.Split(header, ",") {
		part = strings.TrimSpace(part)
		segments := strings.Split(part, ";")
		if len(segments) >= 2 && strings.Contains(segments[1], `rel="next"`) {
			u := strings.TrimSpace(segments[0])
			return strings.Trim(u, "<>")
		}
	}
	return ""
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
	firstEventsURL := provider.BaseUrl + "/api/v1/calendar_events?" + params.Encode()

	// Step 3: fetch calendar events (paginated)
	var rawEvents []map[string]interface{}
	for eventsURL := firstEventsURL; eventsURL != ""; {
		evReq, err := http.NewRequest("GET", eventsURL, nil)
		if err != nil {
			return nil, err
		}
		evReq.Header.Add("Authorization", "Bearer "+provider.AccessKey)
		evReq.Header.Add("Accept", "application/json")

		evResp, err := srv.Client.Do(evReq)
		if err != nil {
			return nil, err
		}
		if evResp.StatusCode != http.StatusOK {
			evResp.Body.Close()
			return nil, fmt.Errorf("canvas API returned %d fetching calendar events for provider %d", evResp.StatusCode, provider.ID)
		}

		var page []map[string]interface{}
		if err := json.NewDecoder(evResp.Body).Decode(&page); err != nil {
			evResp.Body.Close()
			return nil, err
		}
		eventsURL = nextPageURL(evResp.Header.Get("Link"))
		evResp.Body.Close()
		rawEvents = append(rawEvents, page...)
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
			// Assumes Canvas calendar event IDs fit within 1_000_000 per provider.
			id = models.CanvasClassIDOffset + provider.ID*1_000_000 + uint(idFloat)
		}

		ev := models.FacilityProgramClassEvent{
			IsCanvasEvent: true,
			IsCancelled:   isCancelled,
			ProgramID:     models.CanvasProgramIDOffset + provider.ID,
			ProgramName:   provider.Name,
			ClassName:     title,
			StartTime:     &startAt,
			EndTime:       &endAt,
			ClassStatus:   models.Active,
		}
		ev.ID = id
		events = append(events, ev)
	}
	return events, nil
}

// fetchCanvasClassesAllProviders returns a ProgramClass for every Canvas course
// across all active Canvas provider platforms. Failures per-provider are logged
// and skipped so a single unreachable provider doesn't break the response.
func (srv *Server) fetchCanvasClassesAllProviders() ([]models.ProgramClass, error) {
	providers, err := srv.Db.GetAllActiveProviderPlatforms()
	if err != nil {
		return nil, err
	}
	now := time.Now()
	var result []models.ProgramClass
	for _, provider := range providers {
		if provider.Type != models.CanvasOSS && provider.Type != models.CanvasCloud {
			continue
		}
		connectionID := provider.ID
		programID := models.CanvasProgramIDOffset + connectionID
		apiURL := provider.BaseUrl + "/api/v1/accounts/" + provider.AccountID + "/courses?per_page=100"
		courses, err := srv.fetchAllCanvasPages(&provider, apiURL, 0)
		if err != nil {
			log.WithError(err).Warnf("failed to fetch canvas courses for provider %d, skipping", connectionID)
			continue
		}
		for _, course := range courses {
			courseIDFloat, _ := course["id"].(float64)
			rawCourseID := uint(courseIDFloat)
			courseID := models.CanvasClassIDOffset + connectionID*1_000_000 + rawCourseID
			name, _ := course["name"].(string)
			description, _ := course["course_code"].(string)
			var startDt time.Time
			if startAt, ok := course["start_at"].(string); ok && startAt != "" {
				startDt, _ = time.Parse("2006-01-02T15:04:05Z", startAt)
			}
			var endDt *time.Time
			status := models.Active
			if endAt, ok := course["end_at"].(string); ok && endAt != "" {
				if t, parseErr := time.Parse("2006-01-02T15:04:05Z", endAt); parseErr == nil {
					endDt = &t
					if !t.After(now) {
						status = models.Completed
					}
				}
			}
			result = append(result, models.ProgramClass{
				DatabaseFields: models.DatabaseFields{ID: courseID},
				ProgramID:      programID,
				FacilityID:     0,
				Name:           name,
				Description:    description,
				StartDt:        startDt,
				EndDt:          endDt,
				Status:         status,
			})
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
		if provider.Type != models.CanvasOSS && provider.Type != models.CanvasCloud {
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
	if provider.Type != models.CanvasOSS && provider.Type != models.CanvasCloud {
		return newInvalidIdServiceError(fmt.Errorf("provider %d is not a canvas type", connectionID), "program ID")
	}
	prog, err := srv.fetchCanvasProviderProgram(provider)
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
	completionRate := srv.computeCanvasCompletionRate(provider)
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
		CompletionRate:         completionRate,
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
	if provider.Type != models.CanvasOSS && provider.Type != models.CanvasCloud {
		return newInvalidIdServiceError(fmt.Errorf("provider %d is not a canvas type", connectionID), "program ID")
	}

	if r.URL.Query().Get("all") == "true" {
		return srv.handleGetCanvasClassesByFacility(w, r, provider, programID, connectionID)
	}

	coursesURL := provider.BaseUrl + "/api/v1/accounts/" + provider.AccountID + "/courses?per_page=100"
	courses, err := srv.fetchAllCanvasPages(provider, coursesURL, 0)
	if err != nil {
		return newInternalServerServiceError(err, "failed to fetch canvas courses")
	}

	now := time.Now()
	classes := make([]models.ProgramClassDetail, 0, len(courses))
	for _, course := range courses {
		courseIDFloat, _ := course["id"].(float64)
		rawCourseID := uint(courseIDFloat)
		courseID := models.CanvasClassIDOffset + connectionID*1_000_000 + rawCourseID
		name, _ := course["name"].(string)
		description, _ := course["course_code"].(string)

		var startDt time.Time
		if startAt, ok := course["start_at"].(string); ok && startAt != "" {
			startDt, _ = time.Parse("2006-01-02T15:04:05Z", startAt)
		}

		var endDt *time.Time
		status := models.Active
		if endAt, ok := course["end_at"].(string); ok && endAt != "" {
			if t, parseErr := time.Parse("2006-01-02T15:04:05Z", endAt); parseErr == nil {
				endDt = &t
				if !t.After(now) {
					status = models.Completed
				}
			}
		}

		classes = append(classes, models.ProgramClassDetail{
			ProgramClass: models.ProgramClass{
				DatabaseFields: models.DatabaseFields{ID: courseID},
				ProgramID:      programID,
				FacilityID:     0,
				Name:           name,
				Description:    description,
				StartDt:        startDt,
				EndDt:          endDt,
				Status:         status,
			},
			FacilityName: provider.Name,
		})
	}

	// Determine which facility to scope enrollment counts to.
	claims := r.Context().Value(ClaimsKey).(*Claims)
	var facilityID uint
	if facilityIDStr := r.URL.Query().Get("facility_id"); facilityIDStr != "" {
		if id, parseErr := strconv.Atoi(facilityIDStr); parseErr == nil && id > 0 {
			facilityID = uint(id)
		}
	}
	if facilityID == 0 && !claims.canSwitchFacility() {
		facilityID = claims.FacilityID
	}

	// Concurrently count mapped enrollees for each course, scoped to facility when set.
	counts := make(map[uint]int64, len(classes))
	var mu sync.Mutex
	var wg sync.WaitGroup
	for i := range classes {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			rawID := classes[idx].ProgramClass.ID - models.CanvasClassIDOffset - connectionID*1_000_000
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
		rawIDs[i] = cls.ProgramClass.ID - models.CanvasClassIDOffset - connectionID*1_000_000
	}
	scheduleEvents := srv.fetchCanvasCoursesScheduleEvents(provider, rawIDs)
	timezone := srv.getQueryContext(r).Timezone
	for i, cls := range classes {
		rawID := cls.ProgramClass.ID - models.CanvasClassIDOffset - connectionID*1_000_000
		if ev, ok := scheduleEvents[rawID]; ok {
			classes[i].ProgramClass.Events = []models.ProgramClassEvent{ev}
			sched, _ := services.FormatClassScheduleAndRoom([]models.ProgramClassEvent{ev}, timezone)
			classes[i].Schedule = sched
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

	// Build course metadata list.
	type courseEntry struct {
		id          uint
		name        string
		description string
		startDt     time.Time
		endDt       *time.Time
		status      models.ClassStatus
	}
	now := time.Now()
	entries := make([]courseEntry, 0, len(courses))
	for _, course := range courses {
		courseIDFloat, _ := course["id"].(float64)
		rawCourseID := uint(courseIDFloat)
		courseID := models.CanvasClassIDOffset + connectionID*1_000_000 + rawCourseID
		name, _ := course["name"].(string)
		description, _ := course["course_code"].(string)
		var startDt time.Time
		if s, ok := course["start_at"].(string); ok && s != "" {
			startDt, _ = time.Parse("2006-01-02T15:04:05Z", s)
		}
		var endDt *time.Time
		status := models.Active
		if s, ok := course["end_at"].(string); ok && s != "" {
			if t, parseErr := time.Parse("2006-01-02T15:04:05Z", s); parseErr == nil {
				endDt = &t
				if !t.After(now) {
					status = models.Completed
				}
			}
		}
		entries = append(entries, courseEntry{id: courseID, name: name, description: description, startDt: startDt, endDt: endDt, status: status})
	}

	// Get all facilities.
	var facilities []models.Facility
	if err := srv.Db.Order("name").Find(&facilities).Error; err != nil {
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
			rawID := entries[idx].id - models.CanvasClassIDOffset - connectionID*1_000_000
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
		rawIDs[i] = e.id - models.CanvasClassIDOffset - connectionID*1_000_000
	}
	scheduleEvents := srv.fetchCanvasCoursesScheduleEvents(provider, rawIDs)
	timezone := srv.getQueryContext(r).Timezone

	// Build one row per (facility × course).
	classes := make([]models.ProgramClassDetail, 0, len(facilities)*len(entries))
	for _, facility := range facilities {
		for i, entry := range entries {
			enrolled := int64(0)
			if facilityCounts[i] != nil {
				enrolled = facilityCounts[i][facility.ID]
			}
			rawID := rawIDs[i]
			var sched string
			var evSlice []models.ProgramClassEvent
			if ev, ok := scheduleEvents[rawID]; ok {
				evSlice = []models.ProgramClassEvent{ev}
				sched, _ = services.FormatClassScheduleAndRoom(evSlice, timezone)
			}
			classes = append(classes, models.ProgramClassDetail{
				ProgramClass: models.ProgramClass{
					DatabaseFields: models.DatabaseFields{ID: entry.id},
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

	var rawEvents []map[string]interface{}
	for eventsURL := provider.BaseUrl + "/api/v1/calendar_events?" + params.Encode(); eventsURL != ""; {
		req, err := http.NewRequest("GET", eventsURL, nil)
		if err != nil {
			break
		}
		req.Header.Add("Authorization", "Bearer "+provider.AccessKey)
		req.Header.Add("Accept", "application/json")
		resp, err := srv.Client.Do(req)
		if err != nil {
			break
		}
		var page []map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&page); err != nil {
			resp.Body.Close()
			break
		}
		eventsURL = nextPageURL(resp.Header.Get("Link"))
		resp.Body.Close()
		rawEvents = append(rawEvents, page...)
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

// countMappedCanvasEnrolleesPerFacility fetches active enrollments for a Canvas course
// and returns a map of facility_id → count of mapped users from that facility.
func (srv *Server) countMappedCanvasEnrolleesPerFacility(provider *models.ProviderPlatform, rawCourseID uint) map[uint]int64 {
	enrollURL := fmt.Sprintf(
		"%s/api/v1/courses/%d/enrollments?type[]=StudentEnrollment&state[]=active&per_page=100",
		provider.BaseUrl, rawCourseID,
	)
	enrollments, err := srv.fetchAllCanvasPages(provider, enrollURL, 0)
	if err != nil {
		log.WithError(err).Warnf("countMappedCanvasEnrolleesPerFacility: failed to fetch enrollments for course %d", rawCourseID)
		return nil
	}
	canvasUserIDs := make([]string, 0, len(enrollments))
	for _, e := range enrollments {
		if u, ok := e["user"].(map[string]interface{}); ok {
			if id, ok := u["id"].(float64); ok {
				canvasUserIDs = append(canvasUserIDs, fmt.Sprintf("%d", int(id)))
			}
		}
	}
	if len(canvasUserIDs) == 0 {
		return map[uint]int64{}
	}
	type row struct {
		FacilityID uint  `gorm:"column:facility_id"`
		Count      int64 `gorm:"column:count"`
	}
	var rows []row
	srv.Db.Raw(`
		SELECT u.facility_id, COUNT(*) AS count
		FROM provider_user_mappings pum
		JOIN users u ON u.id = pum.user_id
		WHERE pum.provider_platform_id = ? AND pum.external_user_id IN ?
		GROUP BY u.facility_id
	`, provider.ID, canvasUserIDs).Scan(&rows)
	result := make(map[uint]int64, len(rows))
	for _, r := range rows {
		result[r.FacilityID] = r.Count
	}
	return result
}

// decodeCanvasClassID recovers (providerID, rawCourseID) from an encoded Canvas class ID.
func decodeCanvasClassID(classID uint) (providerID uint, rawCourseID uint) {
	remainder := classID - models.CanvasClassIDOffset
	return remainder / 1_000_000, remainder % 1_000_000
}

// countMappedCanvasEnrolleesForFacility is like countMappedCanvasEnrollees but
// only counts users belonging to the given facility.
func (srv *Server) countMappedCanvasEnrolleesForFacility(provider *models.ProviderPlatform, rawCourseID uint, facilityID uint) int64 {
	enrollURL := fmt.Sprintf(
		"%s/api/v1/courses/%d/enrollments?type[]=StudentEnrollment&state[]=active&per_page=100",
		provider.BaseUrl, rawCourseID,
	)
	enrollments, err := srv.fetchAllCanvasPages(provider, enrollURL, 0)
	if err != nil {
		log.WithError(err).Warnf("countMappedCanvasEnrolleesForFacility: failed to fetch enrollments for course %d", rawCourseID)
		return 0
	}

	canvasUserIDs := make([]string, 0, len(enrollments))
	for _, e := range enrollments {
		if u, ok := e["user"].(map[string]interface{}); ok {
			if id, ok := u["id"].(float64); ok {
				canvasUserIDs = append(canvasUserIDs, fmt.Sprintf("%d", int(id)))
			}
		}
	}
	if len(canvasUserIDs) == 0 {
		return 0
	}

	var count int64
	srv.Db.Model(&models.ProviderUserMapping{}).
		Joins("JOIN users ON users.id = provider_user_mappings.user_id").
		Where("provider_user_mappings.provider_platform_id = ? AND provider_user_mappings.external_user_id IN ? AND users.facility_id = ?",
			provider.ID, canvasUserIDs, facilityID).
		Count(&count)
	return count
}

// countMappedCanvasEnrollees fetches active student enrollments for a Canvas
// course and returns how many of those students have a ProviderUserMapping.
func (srv *Server) countMappedCanvasEnrollees(provider *models.ProviderPlatform, rawCourseID uint) int64 {
	enrollURL := fmt.Sprintf(
		"%s/api/v1/courses/%d/enrollments?type[]=StudentEnrollment&state[]=active&per_page=100",
		provider.BaseUrl, rawCourseID,
	)
	enrollments, err := srv.fetchAllCanvasPages(provider, enrollURL, 0)
	if err != nil {
		log.WithError(err).Warnf("countMappedCanvasEnrollees: failed to fetch enrollments for course %d", rawCourseID)
		return 0
	}

	canvasUserIDs := make([]string, 0, len(enrollments))
	for _, e := range enrollments {
		if u, ok := e["user"].(map[string]interface{}); ok {
			if id, ok := u["id"].(float64); ok {
				canvasUserIDs = append(canvasUserIDs, fmt.Sprintf("%d", int(id)))
			}
		}
	}
	if len(canvasUserIDs) == 0 {
		return 0
	}

	var count int64
	srv.Db.Model(&models.ProviderUserMapping{}).
		Where("provider_platform_id = ? AND external_user_id IN ?", provider.ID, canvasUserIDs).
		Count(&count)
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

	var totalMapped, completedMapped int64
	srv.Db.Model(&models.ProviderUserMapping{}).
		Where("provider_platform_id = ? AND external_user_id IN ?", provider.ID, allIDs).
		Count(&totalMapped)
	if totalMapped == 0 {
		return 0
	}
	if len(completedIDs) > 0 {
		srv.Db.Model(&models.ProviderUserMapping{}).
			Where("provider_platform_id = ? AND external_user_id IN ?", provider.ID, completedIDs).
			Count(&completedMapped)
	}
	return float64(completedMapped) / float64(totalMapped) * 100
}

func (srv *Server) handleGetCanvasClassDetail(w http.ResponseWriter, r *http.Request, log sLog, classID uint) error {
	providerID, rawCourseID := decodeCanvasClassID(classID)
	provider, err := srv.Db.GetProviderPlatformByID(int(providerID))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if provider.Type != models.CanvasOSS && provider.Type != models.CanvasCloud {
		return newInvalidIdServiceError(fmt.Errorf("provider %d is not a canvas type", providerID), "class ID")
	}

	url := fmt.Sprintf("%s/api/v1/courses/%d", provider.BaseUrl, rawCourseID)
	req, err := http.NewRequest("GET", url, nil)
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

	name, _ := course["name"].(string)
	description, _ := course["course_code"].(string)
	programID := models.CanvasProgramIDOffset + providerID

	var startDt time.Time
	if s, ok := course["start_at"].(string); ok && s != "" {
		startDt, _ = time.Parse("2006-01-02T15:04:05Z", s)
	}

	var endDt *time.Time
	status := models.Active
	if s, ok := course["end_at"].(string); ok && s != "" {
		if t, parseErr := time.Parse("2006-01-02T15:04:05Z", s); parseErr == nil {
			endDt = &t
			if !t.After(time.Now()) {
				status = models.Completed
			}
		}
	}

	facilityID := srv.getQueryContext(r).FacilityID
	var enrolled int64
	if facilityID != 0 {
		enrolled = srv.countMappedCanvasEnrolleesForFacility(provider, rawCourseID, facilityID)
	} else {
		enrolled = srv.countMappedCanvasEnrollees(provider, rawCourseID)
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
		Name:           name,
		Description:    description,
		StartDt:        startDt,
		EndDt:          endDt,
		Status:         status,
		Enrolled:       enrolled,
		Program: &models.Program{
			DatabaseFields: models.DatabaseFields{ID: programID},
			Name:           "College - " + provider.Name,
		},
		Events:      events,
		Enrollments: []models.ProgramClassEnrollment{},
	}
	return writeJsonResponse(w, http.StatusOK, cls)
}

type canvasScheduleEvent struct {
	ID          uint      `json:"id"`
	Title       string    `json:"title"`
	StartAt     time.Time `json:"start_at"`
	EndAt       time.Time `json:"end_at"`
	IsCancelled bool      `json:"is_cancelled"`
}

func (srv *Server) handleGetCanvasClassSchedule(w http.ResponseWriter, r *http.Request, log sLog) error {
	classID, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class_id")
	}
	if uint(classID) < models.CanvasClassIDOffset {
		return newInvalidIdServiceError(fmt.Errorf("class %d is not a canvas class", classID), "class_id")
	}
	providerID, rawCourseID := decodeCanvasClassID(uint(classID))
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
			id = models.CanvasClassIDOffset + providerID*1_000_000 + uint(idFloat)
		}
		events = append(events, canvasScheduleEvent{
			ID:          id,
			Title:       title,
			StartAt:     startAt,
			EndAt:       endAt,
			IsCancelled: isCancelled,
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
	providerID, rawCourseID := decodeCanvasClassID(classID)
	provider, err := srv.Db.GetProviderPlatformByID(int(providerID))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if provider.Type != models.CanvasOSS && provider.Type != models.CanvasCloud {
		return newInvalidIdServiceError(fmt.Errorf("provider %d is not a canvas type", providerID), "class ID")
	}

	enrollURL := fmt.Sprintf(
		"%s/api/v1/courses/%d/enrollments?type[]=StudentEnrollment&state[]=active&per_page=100",
		provider.BaseUrl, rawCourseID,
	)
	canvasEnrollments, err := srv.fetchAllCanvasPages(provider, enrollURL, 0)
	if err != nil {
		return newInternalServerServiceError(err, "failed to fetch canvas enrollments")
	}

	canvasUserIDs := make([]string, 0, len(canvasEnrollments))
	for _, e := range canvasEnrollments {
		if u, ok := e["user"].(map[string]interface{}); ok {
			if id, ok := u["id"].(float64); ok {
				canvasUserIDs = append(canvasUserIDs, fmt.Sprintf("%d", int(id)))
			}
		}
	}

	facilityID := srv.getQueryContext(r).FacilityID

	type mappingInfo struct {
		NameFull string
		DocID    string
		UserID   uint
	}
	type mappingRow struct {
		ExternalUserID string
		UserID         uint
		NameFirst      string
		NameLast       string
		DocID          string
	}
	userMap := make(map[string]mappingInfo)
	if len(canvasUserIDs) > 0 {
		var mappingRows []mappingRow
		q := srv.Db.Model(&models.ProviderUserMapping{}).
			Select("provider_user_mappings.external_user_id, provider_user_mappings.user_id, users.name_first, users.name_last, users.doc_id").
			Joins("JOIN users ON users.id = provider_user_mappings.user_id").
			Where("provider_user_mappings.provider_platform_id = ? AND provider_user_mappings.external_user_id IN ?", providerID, canvasUserIDs)
		if facilityID != 0 {
			q = q.Where("users.facility_id = ?", facilityID)
		}
		q.Scan(&mappingRows)
		for _, m := range mappingRows {
			userMap[m.ExternalUserID] = mappingInfo{
				NameFull: m.NameFirst + " " + m.NameLast,
				DocID:    m.DocID,
				UserID:   m.UserID,
			}
		}
	}

	rows := make([]canvasEnrollmentRow, 0, len(canvasEnrollments))
	for i, e := range canvasEnrollments {
		canvasUserIDStr := ""
		if u, ok := e["user"].(map[string]interface{}); ok {
			if id, ok := u["id"].(float64); ok {
				canvasUserIDStr = fmt.Sprintf("%d", int(id))
			}
		}

		info, matched := userMap[canvasUserIDStr]
		if !matched {
			continue
		}

		rows = append(rows, canvasEnrollmentRow{
			ProgramClassEnrollment: models.ProgramClassEnrollment{
				DatabaseFields:   models.DatabaseFields{ID: uint(i + 1)},
				ClassID:          classID,
				UserID:           info.UserID,
				EnrollmentStatus: models.Enrolled,
			},
			NameFull:  info.NameFull,
			DocID:     info.DocID,
			ClassName: "",
		})
	}

	args := srv.getQueryContext(r)
	args.Total = int64(len(rows))
	return writePaginatedResponse(w, http.StatusOK, rows, args.IntoMeta())
}
