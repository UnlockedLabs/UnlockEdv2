package handlers

import (
	"UnlockEdv2/src/models"
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

func parseDateRangeRequest(r *http.Request) (*time.Time, *time.Time, string, error) {
	q := r.URL.Query()
	if q.Get("all_time") == "true" {
		return nil, nil, "all", nil
	}
	metricsDateFormat := "2006-01-02"
	startStr := q.Get("start_date")
	endStr := q.Get("end_date")
	if startStr == "" && endStr == "" {
		end := time.Now()
		start := end.AddDate(0, 0, -30)
		startDay := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, start.Location())
		endDay := time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, end.Location()).AddDate(0, 0, 1)
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
	today := time.Now()
	todayMidnight := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	if end.After(todayMidnight) {
		return nil, nil, "", newBadRequestServiceError(fmt.Errorf("end date cannot be in the future"), "date range")
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
