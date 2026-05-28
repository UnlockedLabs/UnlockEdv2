package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"net/http"
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
//	GET /api/v1/accounts/{accountID}/courses?include[]=total_students&per_page=100
//
// and builds the synthetic program entry. CompletionRate and AttendanceRate are
// omitted (nil) in this initial implementation — they would require O(n)
// per-course enrollment-state calls and can be added as a follow-up.
func (srv *Server) fetchCanvasProviderProgram(provider *models.ProviderPlatform) (models.ProgramsOverviewTable, error) {
	url := provider.BaseUrl + "/api/v1/accounts/" + provider.AccountID +
		"/courses?include[]=total_students&per_page=100"

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return models.ProgramsOverviewTable{}, err
	}
	req.Header.Add("Authorization", "Bearer "+provider.AccessKey)
	req.Header.Add("Accept", "application/json")

	resp, err := srv.Client.Do(req)
	if err != nil {
		return models.ProgramsOverviewTable{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return models.ProgramsOverviewTable{}, fmt.Errorf("canvas API returned %d for provider %d", resp.StatusCode, provider.ID)
	}

	var courses []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&courses); err != nil {
		return models.ProgramsOverviewTable{}, err
	}

	var totalClasses, activeClasses, totalEnrollments int64
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
		if ts, ok := course["total_students"].(float64); ok {
			totalEnrollments += int64(ts)
		}
	}

	programID := models.CanvasProgramIDOffset + provider.ID
	return models.ProgramsOverviewTable{
		ProgramID:              programID,
		ProgramName:            "College - " + provider.Name,
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

	url := provider.BaseUrl + "/api/v1/accounts/" + provider.AccountID +
		"/courses?per_page=100"
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

	var courses []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&courses); err != nil {
		return newInternalServerServiceError(err, "failed to decode canvas courses")
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

	// Concurrently count mapped enrollees for each course.
	counts := make(map[uint]int64, len(classes))
	var mu sync.Mutex
	var wg sync.WaitGroup
	for i := range classes {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			rawID := classes[idx].ProgramClass.ID - models.CanvasClassIDOffset - connectionID*1_000_000
			n := srv.countMappedCanvasEnrollees(provider, rawID)
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

	args := srv.getQueryContext(r)
	args.Total = int64(len(classes))
	return writePaginatedResponse(w, http.StatusOK, classes, args.IntoMeta())
}

// decodeCanvasClassID recovers (providerID, rawCourseID) from an encoded Canvas class ID.
func decodeCanvasClassID(classID uint) (providerID uint, rawCourseID uint) {
	remainder := classID - models.CanvasClassIDOffset
	return remainder / 1_000_000, remainder % 1_000_000
}

// countMappedCanvasEnrollees fetches active student enrollments for a Canvas
// course and returns how many of those students have a ProviderUserMapping.
func (srv *Server) countMappedCanvasEnrollees(provider *models.ProviderPlatform, rawCourseID uint) int64 {
	url := fmt.Sprintf(
		"%s/api/v1/courses/%d/enrollments?type[]=StudentEnrollment&state[]=active&per_page=100",
		provider.BaseUrl, rawCourseID,
	)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		log.WithError(err).Warn("countMappedCanvasEnrollees: failed to build request")
		return 0
	}
	req.Header.Add("Authorization", "Bearer "+provider.AccessKey)
	req.Header.Add("Accept", "application/json")

	resp, err := srv.Client.Do(req)
	if err != nil {
		log.WithError(err).Warn("countMappedCanvasEnrollees: failed to reach canvas")
		return 0
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Warnf("countMappedCanvasEnrollees: canvas returned %d for course %d", resp.StatusCode, rawCourseID)
		return 0
	}

	var enrollments []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&enrollments); err != nil {
		log.WithError(err).Warn("countMappedCanvasEnrollees: failed to decode enrollments")
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

	enrolled := srv.countMappedCanvasEnrollees(provider, rawCourseID)

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
		Events:      []models.ProgramClassEvent{},
		Enrollments: []models.ProgramClassEnrollment{},
	}
	return writeJsonResponse(w, http.StatusOK, cls)
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

	url := fmt.Sprintf(
		"%s/api/v1/courses/%d/enrollments?type[]=StudentEnrollment&state[]=active&per_page=100",
		provider.BaseUrl, rawCourseID,
	)
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

	var canvasEnrollments []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&canvasEnrollments); err != nil {
		return newInternalServerServiceError(err, "failed to decode canvas enrollments")
	}

	canvasUserIDs := make([]string, 0, len(canvasEnrollments))
	for _, e := range canvasEnrollments {
		if u, ok := e["user"].(map[string]interface{}); ok {
			if id, ok := u["id"].(float64); ok {
				canvasUserIDs = append(canvasUserIDs, fmt.Sprintf("%d", int(id)))
			}
		}
	}

	type mappingInfo struct {
		NameFull string
		DocID    string
		UserID   uint
	}
	userMap := make(map[string]mappingInfo)
	if len(canvasUserIDs) > 0 {
		var mappings []models.ProviderUserMapping
		srv.Db.Model(&models.ProviderUserMapping{}).
			Preload("User").
			Where("provider_platform_id = ? AND external_user_id IN ?", providerID, canvasUserIDs).
			Find(&mappings)
		for _, m := range mappings {
			if m.User != nil {
				userMap[m.ExternalUserID] = mappingInfo{
					NameFull: m.User.NameFirst + " " + m.User.NameLast,
					DocID:    m.User.DocID,
					UserID:   m.UserID,
				}
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
