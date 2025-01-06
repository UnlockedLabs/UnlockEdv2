package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/nats-io/nats.go"
)

func (srv *Server) registerDashboardRoutes() []routeDef {
	axx := models.Feature(models.ProviderAccess)
	return []routeDef{
		{"GET /api/login-metrics", srv.handleLoginMetrics, true, models.Feature()},
		{"GET /api/users/{id}/student-dashboard", srv.handleStudentDashboard, false, models.Feature()},
		{"GET /api/users/{id}/admin-dashboard", srv.handleAdminDashboard, true, models.Feature()},
		{"GET /api/users/{id}/admin-layer2", srv.handleAdminLayer2, true, models.Feature()},
		{"GET /api/users/{id}/catalog", srv.handleUserCatalog, false, axx},
		{"GET /api/users/{id}/courses", srv.handleUserCourses, false, axx},
	}
}

func (srv *Server) handleStudentDashboard(w http.ResponseWriter, r *http.Request, log sLog) error {
	faciltiyId := srv.getFacilityID(r)
	userId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || !srv.canViewUserData(r, userId) {
		return newInvalidIdServiceError(err, "user ID")
	}
	studentDashboard, err := srv.Db.GetStudentDashboardInfo(userId, faciltiyId)
	if err != nil {
		log.add("faciltiyId", faciltiyId)
		log.add("userId", userId)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, studentDashboard)
}

func (srv *Server) handleAdminDashboard(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims := r.Context().Value(ClaimsKey).(*Claims)
	adminDashboard, err := srv.Db.GetAdminDashboardInfo(claims.FacilityID)
	if err != nil {
		log.add("facilityId", claims.FacilityID)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, adminDashboard)
}

func (srv *Server) handleAdminLayer2(w http.ResponseWriter, r *http.Request, log sLog) error {
	facility := r.URL.Query().Get("facility")
	claims := r.Context().Value(ClaimsKey).(*Claims)
	var facilityId *uint
	// Logic goes here for facility
	switch facility {
	case "all":
		facilityId = nil
	case "":
		facilityId = &claims.FacilityID
	default:
		facilityIdInt, err := strconv.Atoi(facility)
		if err != nil {
			return newInvalidIdServiceError(err, "facility")
		}
		ref := uint(facilityIdInt)
		facilityId = &ref
	}

	adminDashboard, err := srv.Db.GetAdminLayer2Info(facilityId)
	if err != nil {
		log.add("facilityId", claims.FacilityID)
		return newDatabaseServiceError(err)
	}

	return writeJsonResponse(w, http.StatusOK, adminDashboard)
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
		acitveUsers, err := srv.Db.GetNumberOfActiveUsersForTimePeriod(true, days, facilityId)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		totalLogins, err := srv.Db.GetTotalLogins(days, facilityId)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		totalUsers, err := srv.Db.GetTotalUsers(facilityId)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		newAdded, err := srv.Db.NewUsersInTimePeriod(days, facilityId)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		loginTimes, err := srv.Db.GetLoginActivity(days, facilityId)
		if err != nil {
			return newDatabaseServiceError(err)
		}
		if totalUsers == 0 {
			totalUsers = 1
		}
		activityMetrics := struct {
			ActiveUsers      int64                  `json:"active_users"`
			TotalLogins      int64                  `json:"total_logins"`
			LoginsPerDay     int64                  `json:"logins_per_day"`
			PercentActive    int64                  `json:"percent_active"`
			PercentInactive  int64                  `json:"percent_inactive"`
			TotalUsers       int64                  `json:"total_users"`
			Facility         string                 `json:"facility,omitempty"`
			NewStudentsAdded int64                  `json:"new_residents_added"`
			PeakLoginTimes   []models.LoginActivity `json:"peak_login_times"`
		}{
			ActiveUsers:      acitveUsers,
			TotalLogins:      totalLogins,
			LoginsPerDay:     totalLogins / int64(days),
			PercentActive:    acitveUsers / totalUsers * 100,
			PercentInactive:  100 - (acitveUsers / totalUsers * 100),
			TotalUsers:       totalUsers,
			Facility:         facilityName,
			NewStudentsAdded: newAdded,
			PeakLoginTimes:   loginTimes,
		}
		jsonB, err := json.Marshal(models.DefaultResource(activityMetrics))
		if err != nil {
			return newMarshallingBodyServiceError(err)
		}
		_, err = srv.buckets[LoginMetrics].Put(key, jsonB)
		if err != nil {
			return newInternalServerServiceError(err, "Error caching login metrics")
		}
		_, err = w.Write(jsonB)
		return err
	} else if err != nil {
		return newInternalServerServiceError(err, "Error retrieving login metrics")
	}
	_, err = w.Write(cached.Value())
	return err
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
