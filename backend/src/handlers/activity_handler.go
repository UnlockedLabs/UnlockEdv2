package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func (srv *Server) registerActivityRoutes() []routeDef {
	axx := models.ProviderAccess
	return []routeDef{
		newRoute("POST /api/analytics/faq-click", srv.handleUserFAQClick),
		validatedFeatureRoute("GET /api/users/{id}/daily-activity", srv.handleGetDailyActivityByUserID, axx, UserRoleResolver("id")),
		/* admin */
		adminFeatureRoute("GET /api/courses/{id}/activity", srv.handleGetCourseActivity, axx),
	}
}

/****
 * @Query Params:
 * ?start_date
 * ?end_date
 ****/
func (srv *Server) handleGetDailyActivityByUserID(w http.ResponseWriter, r *http.Request, log sLog) error {
	userID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	startDate, err := time.Parse("2006-01-02", strings.Split(r.URL.Query().Get("start_date"), "T")[0])
	if err != nil {
		return newInvalidQueryParamServiceError(err, "start_date")
	}
	endDate, err := time.Parse("2006-01-02", strings.Split(r.URL.Query().Get("end_date"), "T")[0])
	if err != nil {
		return newInvalidQueryParamServiceError(err, "end_date")
	}
	activities, err := srv.Db.GetDailyActivityByUserID(userID, startDate, endDate)
	if err != nil {
		log.error("error getting daily activity by user ID")
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, map[string]any{
		"activities": activities,
	})
}

func (srv *Server) handleGetCourseActivity(w http.ResponseWriter, r *http.Request, log sLog) error {
	courseID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "course ID")
	}
	log.add("course_id", courseID)
	page, perPage := srv.getPaginationInfo(r)
	count, activities, err := srv.Db.GetActivityByCourseID(page, perPage, courseID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, map[string]any{
		"count":      count,
		"activities": activities,
	})
}

func (srv *Server) handleUserFAQClick(w http.ResponseWriter, r *http.Request, log sLog) error {
	var body map[string]any
	err := json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	question, ok := body["question"].(string)
	if !ok || question == "" {
		return newBadRequestServiceError(errors.New("no question found in body"), "Bad Request")
	}
	args := srv.getQueryContext(r)
	err = srv.Db.IncrementUserFAQClick(&args, question)
	if err != nil {
		log.add("question", question)
		log.add("user_id", args.UserID)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, "Question logged successfully")
}
