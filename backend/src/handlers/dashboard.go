package handlers

import (
	"UnlockEdv2/src/models"
	"UnlockEdv2/src/services"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/nats-io/nats.go"
)

func (srv *Server) registerDashboardRoutes() []routeDef {
	axx := models.ProviderAccess
	resolver := UserRoleResolver("id")
	return []routeDef{
		newAdminRoute("GET /api/department-metrics", srv.handleDepartmentMetrics),
		newAdminRoute("GET /api/department-metrics/login-trend", srv.handleDepartmentLoginTrend),
		newAdminRoute("GET /api/department-metrics/facility-comparison", srv.handleFacilityEngagementComparison),
		newAdminRoute("GET /api/department-metrics/knowledge-center", srv.handleKnowledgeCenterMetrics),
		newAdminRoute("GET /api/dashboard/class-metrics", srv.handleClassDashboardMetrics),
		newAdminRoute("GET /api/dashboard/facility-health", srv.handleFacilityHealthSummary),
		newAdminRoute("GET /api/users/{id}/admin-layer2", srv.handleAdminLayer2),
		validatedFeatureRoute("GET /api/users/{id}/catalog", srv.handleUserCatalog, axx, resolver),
		validatedFeatureRoute("GET /api/users/{id}/courses", srv.handleUserCourses, axx, resolver),
		validatedRoute("GET /api/users/{id}/profile", srv.handleResidentProfile, resolver),
	}
}

func (srv *Server) handleResidentProfile(w http.ResponseWriter, r *http.Request, log sLog) error {
	userID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	user, err := srv.Db.GetUserByID(uint(userID))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	days, err := strconv.Atoi(r.URL.Query().Get("days"))
	if err != nil {
		days = 30
	}
	loginData, err := srv.Db.GetUserSessionEngagement(userID, days)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	activityEngagement, err := srv.Db.GetUserOpenContentEngagement(userID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	args := srv.getQueryContext(r)
	topLibraries, err := srv.Db.GetTopFiveLibrariesByUserID(userID, &args)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	recentVideos, err := srv.Db.GetMostRecentFiveVideosByUserID(userID)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	response := struct {
		User               models.User `json:"user"`
		LoginEngagement    any         `json:"session_engagement"`
		ActivityEngagement any         `json:"activity_engagement"`
		TopLibraries       any         `json:"top_libraries"`
		RecentVideos       any         `json:"recent_videos"`
	}{
		User:               *user,
		LoginEngagement:    loginData,
		ActivityEngagement: activityEngagement,
		TopLibraries:       topLibraries,
		RecentVideos:       recentVideos,
	}

	return writeJsonResponse(w, http.StatusOK, response)
}

func (srv *Server) handleAdminLayer2(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims := r.Context().Value(ClaimsKey).(*Claims)
	clearCache := r.URL.Query().Get("reset") == "true"
	facility := r.URL.Query().Get("facility")
	var facilityId *uint
	switch facility {
	case "all":
		facilityId = nil
	case "":
		facilityId = &claims.FacilityID
	default:
		var err error
		facilityIdInt, err := strconv.Atoi(facility)
		if err != nil {
			return newInternalServerServiceError(err, "Facility ID")
		}
		ref := uint(facilityIdInt)
		facilityId = &ref
	}
	key := fmt.Sprintf("admin-layer2-%d", facilityId)
	cached, err := srv.buckets[AdminLayer2].Get(key)
	if err != nil && errors.Is(err, nats.ErrKeyNotFound) || clearCache {
		newCacheData, err := srv.getLayer2Data(r, log)
		if err != nil {
			return newInternalServerServiceError(err, "Error getting admin layer 2 data")
		}
		cacheBytes, err := json.Marshal(newCacheData)
		if err != nil {
			return newMarshallingBodyServiceError(err)
		}
		_, err = srv.buckets[AdminLayer2].Put(key, cacheBytes)
		if err != nil {
			return newInternalServerServiceError(err, "Error caching admin layer 2 data")
		}
		return writeJsonResponse(w, http.StatusOK, newCacheData)
	}
	var cachedData models.CachedDashboard[models.AdminLayer2Join]
	err = json.Unmarshal(cached.Value(), &cachedData)
	if err != nil {
		return newInternalServerServiceError(err, "Error unmarshalling cached data")
	}
	return writeJsonResponse(w, http.StatusOK, cachedData)
}

const metricsDateFormat = "2006-01-02"

func startOfDay(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

// resolvePresetRange resolves a preset range key (e.g. "30d") against the
// server clock, returning the inclusive start day and an exclusive end bound
// (midnight after today, so all of "today" is included). Resolving presets
// server-side keeps the window anchored to the same clock that timestamps the
// data, so a client in a different timezone can't request a window that ends
// before data recorded "now".
func resolvePresetRange(key string) (time.Time, time.Time, bool) {
	now := time.Now()
	today := startOfDay(now)
	endExclusive := today.AddDate(0, 0, 1)
	switch key {
	case "7d":
		return today.AddDate(0, 0, -6), endExclusive, true
	case "30d":
		return today.AddDate(0, 0, -29), endExclusive, true
	case "90d":
		return today.AddDate(0, 0, -89), endExclusive, true
	case "ytd":
		return time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location()), endExclusive, true
	default:
		return time.Time{}, time.Time{}, false
	}
}

func parseDateRangeRequest(r *http.Request) (*time.Time, *time.Time, string, error) {
	q := r.URL.Query()
	if q.Get("all_time") == "true" {
		return nil, nil, "all", nil
	}
	// Preset ranges are resolved against the server clock. Any start_date/end_date
	// the client also sends are ignored in favor of the preset.
	if rangeKey := strings.ToLower(q.Get("range")); rangeKey != "" && rangeKey != "custom" {
		start, end, ok := resolvePresetRange(rangeKey)
		if !ok {
			return nil, nil, "", newInvalidQueryParamServiceError(fmt.Errorf("unknown range %q", rangeKey), "range")
		}
		return &start, &end, fmt.Sprintf("%s_%s", start.Format(metricsDateFormat), end.Format(metricsDateFormat)), nil
	}
	startStr := q.Get("start_date")
	endStr := q.Get("end_date")
	if startStr == "" && endStr == "" {
		now := time.Now()
		startDay := startOfDay(now.AddDate(0, 0, -30))
		endDay := startOfDay(now).AddDate(0, 0, 1)
		return &startDay, &endDay, fmt.Sprintf("%s_%s", startDay.Format(metricsDateFormat), endDay.Format(metricsDateFormat)), nil
	}
	if startStr == "" || endStr == "" {
		return nil, nil, "", newBadRequestServiceError(fmt.Errorf("start date and end date are both required"), "date range")
	}
	start, err := time.Parse(metricsDateFormat, startStr)
	if err != nil {
		return nil, nil, "", newInvalidQueryParamServiceError(err, "start_date")
	}
	end, err := time.Parse(metricsDateFormat, endStr)
	if err != nil {
		return nil, nil, "", newInvalidQueryParamServiceError(err, "end_date")
	}
	if end.Before(start) {
		return nil, nil, "", newBadRequestServiceError(fmt.Errorf("end date must be on or after start date"), "date range")
	}
	// Clamp a future end date to the server's current day rather than rejecting
	// it: a client whose clock or timezone runs ahead of the server should still
	// get data instead of a 400.
	todayMidnight := startOfDay(time.Now())
	if end.After(todayMidnight) {
		end = todayMidnight
	}
	endExclusive := end.AddDate(0, 0, 1)
	return &start, &endExclusive, fmt.Sprintf("%s_%s", start.Format(metricsDateFormat), end.Format(metricsDateFormat)), nil
}

type DashboardMetrics struct {
	ActiveUsers       int64                  `json:"active_users"`
	TotalLogins       int64                  `json:"total_logins"`
	LoginsPerDay      int64                  `json:"logins_per_day"`
	PercentActive     int64                  `json:"percent_active"`
	PercentInactive   int64                  `json:"percent_inactive"`
	TotalResidents    int64                  `json:"total_residents"`
	TotalAdmins       int64                  `json:"total_admins"`
	Facility          string                 `json:"facility,omitempty"`
	NewResidentsAdded int64                  `json:"new_residents_added"`
	PeakLoginTimes    []models.LoginActivity `json:"peak_login_times"`
}

func (srv *Server) handleDepartmentMetrics(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := srv.getQueryContext(r)
	facility := r.URL.Query().Get("facility")
	claims := r.Context().Value(ClaimsKey).(*Claims)
	var facilityId *uint
	facilityName := ""
	clearCache := r.URL.Query().Get("reset") == "true"
	switch facility {
	case "all":
		facilityId = nil
		facilityName = "All"
	case "":
		facilityId = &claims.FacilityID
		facility = strconv.Itoa(int(claims.FacilityID))
		facilityName = claims.FacilityName
	default:
		facilityIdInt, err := strconv.Atoi(facility)
		if err != nil {
			return newInvalidIdServiceError(err, "facility")
		}
		ref := uint(facilityIdInt)
		facilityId = &ref
		facility, err := srv.Db.GetFacilityByID(facilityIdInt)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		facilityName = facility.Name
	}
	start, end, rangeKey, err := parseDateRangeRequest(r)
	if err != nil {
		return err
	}
	key := fmt.Sprintf("%s-%s", facility, rangeKey)
	cached, err := srv.buckets[LoginMetrics].Get(key)
	if err != nil && errors.Is(err, nats.ErrKeyNotFound) || clearCache {
		activeUsers, totalDays, err := srv.Db.GetNumberOfActiveUsersForTimePeriod(&args, true, start, end, facilityId)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		totalLogins, err := srv.Db.GetTotalLogins(&args, start, end, facilityId)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		totalResidents, err := srv.Db.GetTotalUsers(&args, facilityId)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		totalAdmins, err := srv.Db.GetTotalAdmins(&args, facilityId)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		newResidentsAdded, err := srv.Db.NewUsersInTimePeriod(&args, start, end, facilityId)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		loginTimes, err := srv.Db.GetLoginActivity(&args, start, end, facilityId)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		percentActive := int64(0)
		if totalResidents == 0 {
			percentActive = 0
		} else {
			percentActive = activeUsers / totalResidents * 100
		}
		percentInactive := 100 - percentActive
		activityMetrics := DashboardMetrics{
			ActiveUsers:       activeUsers,
			TotalLogins:       totalLogins,
			LoginsPerDay:      totalLogins / int64(totalDays),
			PercentActive:     percentActive,
			PercentInactive:   percentInactive,
			TotalResidents:    totalResidents,
			TotalAdmins:       totalAdmins,
			Facility:          facilityName,
			NewResidentsAdded: newResidentsAdded,
			PeakLoginTimes:    loginTimes,
		}
		var cachedData models.CachedDashboard[DashboardMetrics]
		cachedData.LastCache = time.Now()
		cachedData.Data = activityMetrics

		cacheBytes, err := json.Marshal(cachedData)
		if err != nil {
			return newMarshallingBodyServiceError(err)
		}
		_, err = srv.buckets[LoginMetrics].Put(key, cacheBytes)
		if err != nil {
			return newInternalServerServiceError(err, "Error caching login metrics")
		}
		return writeJsonResponse(w, http.StatusOK, cachedData)
	} else if err != nil {
		return newInternalServerServiceError(err, "Error retrieving login metrics")
	}
	var cachedData models.CachedDashboard[DashboardMetrics]
	err = json.Unmarshal(cached.Value(), &cachedData)
	if err != nil {
		return newInternalServerServiceError(err, "Error unmarshalling cached data")
	}

	return writeJsonResponse(w, http.StatusOK, cachedData)
}

func resolveFacilityFilter(claims *Claims, facility string, ownFacilityID uint) (*uint, error) {
	switch {
	case facility == "all" && claims.canSwitchFacility():
		return nil, nil
	case facility != "" && facility != "all" && claims.canSwitchFacility():
		facilityIdInt, err := strconv.Atoi(facility)
		if err != nil {
			return nil, newInvalidIdServiceError(err, "facility")
		}
		ref := uint(facilityIdInt)
		return &ref, nil
	default:
		return &ownFacilityID, nil
	}
}

func (srv *Server) handleDepartmentLoginTrend(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := srv.getQueryContext(r)
	claims := r.Context().Value(ClaimsKey).(*Claims)
	facilityID, err := resolveFacilityFilter(claims, r.URL.Query().Get("facility"), args.FacilityID)
	if err != nil {
		return err
	}
	start, end, _, err := parseDateRangeRequest(r)
	if err != nil {
		return err
	}
	trend, err := srv.Db.GetDailyLoginActivity(&args, start, end, facilityID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, trend)
}

func (srv *Server) handleKnowledgeCenterMetrics(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := srv.getQueryContext(r)
	claims := r.Context().Value(ClaimsKey).(*Claims)
	facilityID, err := resolveFacilityFilter(claims, r.URL.Query().Get("facility"), args.FacilityID)
	if err != nil {
		return err
	}
	start, end, _, err := parseDateRangeRequest(r)
	if err != nil {
		return err
	}
	total, unique, totalChange, err := srv.Db.GetKCInteractionStats(&args, start, end, facilityID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	avgSession, err := srv.Db.GetKCAvgSessionMinutes(&args, start, end, facilityID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	repeat, err := srv.Db.GetKCRepeatEngagement(&args, start, end, facilityID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	categories, err := srv.Db.GetKCLibraryViewsByCategory(&args, start, end, facilityID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	topLibraries, err := srv.Db.GetKCTopLibraries(&args, start, end, facilityID, 8)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	topVideos, err := srv.Db.GetKCTopVideos(&args, start, end, facilityID, 8)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	metrics := models.KnowledgeCenterMetrics{
		TotalInteractions:       total,
		TotalInteractionsChange: totalChange,
		UniqueResidents:         unique,
		AvgSessionMinutes:       avgSession,
		RepeatEngagement:        repeat,
		LibraryViewsByCategory:  categories,
		TopLibraries:            topLibraries,
		TopVideos:               topVideos,
	}
	return writeJsonResponse(w, http.StatusOK, metrics)
}

func (srv *Server) handleFacilityEngagementComparison(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims := r.Context().Value(ClaimsKey).(*Claims)
	if !claims.canSwitchFacility() {
		return newUnauthorizedServiceError()
	}
	args := srv.getQueryContext(r)
	start, end, _, err := parseDateRangeRequest(r)
	if err != nil {
		return err
	}
	comparison, err := srv.Db.GetFacilityEngagementComparison(&args, start, end)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, comparison)
}

func (srv *Server) handleClassDashboardMetrics(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := srv.getQueryContext(r)
	facility := r.URL.Query().Get("facility")
	var facilityId *uint
	switch facility {
	case "all":
		facilityId = nil
	default:
		facilityId = &args.FacilityID
	}

	metrics, err := srv.Db.GetClassDashboardMetrics(&args, facilityId)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	return writeJsonResponse(w, http.StatusOK, metrics)
}

func (srv *Server) handleFacilityHealthSummary(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := srv.getQueryContext(r)
	claims := r.Context().Value(ClaimsKey).(*Claims)
	facility := r.URL.Query().Get("facility")
	var facilityID *uint
	if facility == "all" && claims.canSwitchFacility() {
		facilityID = nil
	} else {
		facilityID = &args.FacilityID
	}

	days := 3
	if daysQuery := r.URL.Query().Get("days"); daysQuery != "" {
		if parsedDays, err := strconv.Atoi(daysQuery); err == nil {
			days = parsedDays
		}
	}

	service := services.NewClassesService(srv.Db)
	summaries, err := service.GetFacilityHealthSummaries(&args, facilityID, days)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	return writeJsonResponse(w, http.StatusOK, summaries)
}

/**
* GET: /api/users/{id}/catalog
* @Query Params:
* tag: any number of tags to filter by
* ?tag=some_tag&tag=another_tag
* provider_id: provider id to filter by
**/
func (srv *Server) handleUserCatalog(w http.ResponseWriter, r *http.Request, log sLog) error {
	userId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user_id")
	}
	tags := r.URL.Query()["tags"]
	var tagsSplit []string
	if len(tags) > 0 {
		tagsSplit = strings.Split(tags[0], ",")
	}
	search := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("search")))
	order := r.URL.Query().Get("order")
	userCatalog, err := srv.Db.GetUserCatalog(userId, tagsSplit, search, order)
	if err != nil {
		log.add("user_id", userId)
		log.add("search", search)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, userCatalog)
}

func (srv *Server) handleUserCourses(w http.ResponseWriter, r *http.Request, log sLog) error {
	userId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	log.add("user_id", userId)
	args := srv.getQueryContext(r)
	args.UserID = uint(userId)
	userCourses, err := srv.Db.GetUserCourses(&args)
	if err != nil {
		log.add("search", args.Search)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, userCourses)
}

func (srv *Server) getLayer2Data(r *http.Request, log sLog) (models.CachedDashboard[models.AdminLayer2Join], error) {
	facility := r.URL.Query().Get("facility")
	claims := r.Context().Value(ClaimsKey).(*Claims)
	var facilityId *uint
	switch facility {
	case "all":
		facilityId = nil
	case "":
		facilityId = &claims.FacilityID
	default:
		facilityIdInt, err := strconv.Atoi(facility)
		if err != nil {
			return models.CachedDashboard[models.AdminLayer2Join]{}, newInvalidIdServiceError(err, "facility")
		}
		ref := uint(facilityIdInt)
		facilityId = &ref
	}
	totalCourses, err := srv.Db.GetTotalCoursesOffered(facilityId)
	if err != nil {
		log.add("facilityId", claims.FacilityID)
		return models.CachedDashboard[models.AdminLayer2Join]{}, newDatabaseServiceError(err)
	}

	totalStudents, err := srv.Db.GetTotalStudentsEnrolled(facilityId)
	if err != nil {
		log.add("facilityId", claims.FacilityID)
		return models.CachedDashboard[models.AdminLayer2Join]{}, newDatabaseServiceError(err)
	}

	totalActivity, err := srv.Db.GetTotalHourlyActivity(facilityId)
	if err != nil {
		log.add("facilityId", claims.FacilityID)
		return models.CachedDashboard[models.AdminLayer2Join]{}, newDatabaseServiceError(err)
	}

	learningInsights, err := srv.Db.GetLearningInsights(facilityId)
	if err != nil {
		log.add("facilityId", claims.FacilityID)
		return models.CachedDashboard[models.AdminLayer2Join]{}, newDatabaseServiceError(err)
	}

	adminDashboard := models.AdminLayer2Join{
		TotalCoursesOffered:   int64(totalCourses),
		TotalStudentsEnrolled: int64(totalStudents),
		TotalHourlyActivity:   int64(totalActivity),
		LearningInsights:      learningInsights,
	}
	var cachedData models.CachedDashboard[models.AdminLayer2Join]
	cachedData.LastCache = time.Now()
	cachedData.Data = adminDashboard
	return cachedData, nil
}
