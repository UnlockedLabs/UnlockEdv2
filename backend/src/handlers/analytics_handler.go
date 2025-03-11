package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"net/http"
)

func (srv *Server) registerAnalyticRoutes() []routeDef {
	axx := models.Feature()
	return []routeDef{
		{"POST /api/analytics/faq-click", srv.handleUserFAQClick, false, axx},
	}
}

func (srv *Server) handleUserFAQClick(w http.ResponseWriter, r *http.Request, log sLog) error {
	var body map[string]interface{}
	err := json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()
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
