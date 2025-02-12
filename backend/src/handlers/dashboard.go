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
	axx := models.Feature(models.ProviderAccess)
	return []routeDef{
		{"GET /api/login-metrics", srv.handleLoginMetrics, true, models.Feature()},
		{"GET /api/users/{id}/admin-layer2", srv.handleAdminLayer2, true, models.Feature()},
		{"GET /api/users/{id}/catalog", srv.handleUserCatalog, false, axx},
		{"GET /api/users/{id}/courses", srv.handleUserCourses, false, axx},
		{"GET /api/users/{id}/profile", srv.handleResidentProfile, false, axx},
	}
}

// // TODO: ResidentProfileHandler here (for now but it may should be closer to the user)
func (srv *Server) handleResidentProfile(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims := r.Context().Value(ClaimsKey).(*Claims)
	clearCache := r.URL.Query().Get("reset") == "true"

	if !srv.isTesting(r) {
		key := fmt.Sprintf("resident-profile-%d", claims.FacilityID)
		cached, err := srv.buckets[AdminLayer2].Get(key)

		if err != nil && errors.Is(err, nats.ErrKeyNotFound) || clearCache {
			newCacheData := map[string]interface{}{
				"name":   "John Doe",
				"email":  "johndoe@example.com",
				"status": "active",
			}
			cacheBytes, err := json.Marshal(newCacheData)
			if err != nil {
				return newMarshallingBodyServiceError(err)
			}
			_, err = srv.buckets[AdminLayer2].Put(key, cacheBytes)
			if err != nil {
				return newInternalServerServiceError(err, "Error caching resident profile data")
			}
			return writeJsonResponse(w, http.StatusOK, newCacheData)
		}
		// Todo: Declare my model StudentProfile here
		// Ask Rich about the associated table or code?
		var cachedData map[string]interface{}
		err = json.Unmarshal(cached.Value(), &cachedData)
		if err != nil {
			return newInternalServerServiceError(err, "Error unmarshalling cached data")
		}
		return writeJsonResponse(w, http.StatusOK, cachedData)
	} else {
		newCacheData := map[string]interface{}{
			"name":   "John Doe",
			"email":  "johndoe@example.com",
			"status": "active",
		}
		return writeJsonResponse(w, http.StatusOK, newCacheData)
	}
}

func (srv *Server) handleAdminLayer2(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims := r.Context().Value(ClaimsKey).(*Claims)
	clearCache := r.URL.Query().Get("reset") == "true"
	if !srv.isTesting(r) {
		key := fmt.Sprintf("admin-layer2-%d", claims.FacilityID)
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
	} else {
		newCacheData, err := srv.getLayer2Data(r, log)
		if err != nil {
			return newInternalServerServiceError(err, "Error retrieving admin layer 2 data")
		}
		return writeJsonResponse(w, http.StatusOK, newCacheData)
	}
}

func (srv *Server) handleLoginMetrics(w http.ResponseWriter, r *http.Request, log sLog) error {
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
	var days int
	daysQ := r.URL.Query().Get("days")
	if daysQ == "" {
		days = 30
	} else {
		numDays, err := strconv.Atoi(daysQ)
		if err != nil {
			return newInvalidIdServiceError(err, "days")
		}
		days = numDays
	}
	key := fmt.Sprintf("%s-%d", facility, days)
	cached, err := srv.buckets[LoginMetrics].Get(key)
	if err != nil && errors.Is(err, nats.ErrKeyNotFound) || clearCache {
		activeUsers, err := srv.Db.GetNumberOfActiveUsersForTimePeriod(true, days, facilityId)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		totalLogins, err := srv.Db.GetTotalLogins(days, facilityId)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		totalResidents, totalAdmins, err := srv.Db.GetTotalUsers(facilityId)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		newResidentsAdded, newAdminsAdded, err := srv.Db.NewUsersInTimePeriod(days, facilityId)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		loginTimes, err := srv.Db.GetLoginActivity(days, facilityId)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		if totalResidents+totalAdmins == 0 {
			totalResidents = 1
		}
		activityMetrics := struct {
			ActiveUsers       int64                  `json:"active_users"`
			TotalLogins       int64                  `json:"total_logins"`
			LoginsPerDay      int64                  `json:"logins_per_day"`
			PercentActive     int64                  `json:"percent_active"`
			PercentInactive   int64                  `json:"percent_inactive"`
			TotalResidents    int64                  `json:"total_residents"`
			TotalAdmins       int64                  `json:"total_admins"`
			Facility          string                 `json:"facility,omitempty"`
			NewResidentsAdded int64                  `json:"new_residents_added"`
			NewAdminsAdded    int64                  `json:"new_admins_added"`
			PeakLoginTimes    []models.LoginActivity `json:"peak_login_times"`
		}{
			ActiveUsers:       activeUsers,
			TotalLogins:       totalLogins,
			LoginsPerDay:      totalLogins / int64(days),
			PercentActive:     activeUsers / totalResidents * 100,
			PercentInactive:   100 - (activeUsers / totalResidents * 100),
			TotalResidents:    totalResidents,
			TotalAdmins:       totalAdmins,
			Facility:          facilityName,
			NewResidentsAdded: newResidentsAdded,
			NewAdminsAdded:    newAdminsAdded,
			PeakLoginTimes:    loginTimes,
		}
		var cachedData models.CachedDashboard[interface{}]
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
	var cachedData models.CachedDashboard[interface{}]
	err = json.Unmarshal(cached.Value(), &cachedData)
	if err != nil {
		return newInternalServerServiceError(err, "Error unmarshalling cached data")
	}

	return writeJsonResponse(w, http.StatusOK, cachedData)

	// _, err = w.Write(cached.Value())
	// return err
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
	if err != nil || !srv.canViewUserData(r, userId) {
		return newInvalidIdServiceError(err, "user ID")
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
		log.add("userId", userId)
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
	if !srv.canViewUserData(r, userId) {
		return newForbiddenServiceError(err, "You do not have permission to view this user's courses")
	}
	order := r.URL.Query().Get("order")
	orderBy := r.URL.Query().Get("order_by")
	search := r.URL.Query().Get("search")
	search = strings.ToLower(search)
	search = strings.TrimSpace(search)
	tags := r.URL.Query()["tags"]
	// TODO: cache this response
	userCourses, err := srv.Db.GetUserCourses(uint(userId), order, orderBy, search, tags)
	if err != nil {
		log.add("search", search)
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
