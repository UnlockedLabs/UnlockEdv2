package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerOutcomesRoutes() {
	srv.Mux.Handle("GET /api/users/{id}/outcomes", srv.applyMiddleware(http.HandlerFunc(srv.HandleGetOutcomes)))
	srv.Mux.Handle("POST /api/users/{id}/outcomes", srv.applyMiddleware(http.HandlerFunc(srv.HandleCreateOutcome)))
	srv.Mux.Handle("PATCH /api/users/{id}/outcomes/{oid}", srv.applyMiddleware(http.HandlerFunc(srv.HandleUpdateOutcome)))
	srv.Mux.Handle("DELETE /api/users/{id}/outcomes/{oid}", srv.applyMiddleware(http.HandlerFunc(srv.HandleDeleteOutcome)))
}

/****
 * @Query Params:
 * ?type=: "certificate", "grade", "pathway_completion", "college_credit"
 ****/
func (srv *Server) HandleGetOutcomes(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleGetOutcomes",
		"route":   "GET /api/users/{id}/outcomes",
	}
	page, perPage := srv.GetPaginationInfo(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.WithFields(logFields).Errorf("Error parsing user ID from URL: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	logFields["userId"] = id

	// Get type from query param
	typeString := r.URL.Query().Get("type")
	outcomeType := models.OutcomeType(typeString)

	total, outcome, err := srv.Db.GetOutcomesForUser(uint(id), page, perPage, outcomeType)
	if err != nil {
		logFields["databaseMethod"] = "GetOutcomesForUser"
		log.WithFields(logFields).Errorf("Error getting outcomes for user: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	response := models.PaginatedResource[models.Outcome]{}
	response.Meta = models.NewPaginationInfo(page, perPage, total)
	response.Data = outcome
	if err = srv.WriteResponse(w, http.StatusOK, response); err != nil {
		log.WithFields(logFields).Errorf("Error writing response: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (srv *Server) HandleCreateOutcome(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleCreateOutcome",
		"route":   "POST /api/users/{id}/outcomes",
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.WithFields(logFields).Errorf("Error parsing user ID from URL: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	logFields["userId"] = id
	outcome := &models.Outcome{}
	err = json.NewDecoder(r.Body).Decode(&outcome)
	if err != nil {
		log.WithFields(logFields).Errorf("Error decoding request body: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if outcome.UserID == 0 {
		outcome.UserID = uint(id)
	}
	if outcome, err = srv.Db.CreateOutcome(outcome); err != nil {
		logFields["databaseMethod"] = "CreateOutcome"
		log.WithFields(logFields).Errorf("Error creating outcome: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (srv *Server) HandleUpdateOutcome(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleUpdateOutcome",
		"route":   "PATCH /api/users/{id}/outcomes/{oid}",
	}
	id, err := strconv.Atoi(r.PathValue("oid"))
	if err != nil {
		log.WithFields(logFields).Errorf("Error parsing outcome ID from URL: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	logFields["outcomeId"] = id
	uid, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.WithFields(logFields).Errorf("Error parsing user ID from URL: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	logFields["userId"] = uid
	outcome := models.Outcome{}
	err = json.NewDecoder(r.Body).Decode(&outcome)
	defer r.Body.Close()
	if err != nil {
		log.WithFields(logFields).Errorf("Error decoding request body: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if outcome.UserID == 0 {
		outcome.UserID = uint(uid)
	}
	updatedOutcome, err := srv.Db.UpdateOutcome(&outcome, uint(id))
	if err != nil {
		logFields["databaseMethod"] = "UpdateOutcome"
		log.WithFields(logFields).Errorf("Error updating outcome: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	response := models.Resource[models.Outcome]{}
	response.Data = append(response.Data, *updatedOutcome)
	if err := srv.WriteResponse(w, http.StatusOK, response); err != nil {
		log.WithFields(logFields).Errorf("Error writing response to upating outcome: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (srv *Server) HandleDeleteOutcome(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleDeleteOutcome",
		"route":   "DELETE /api/users/{id}/outcomes/{oid}",
	}
	id, err := strconv.Atoi(r.PathValue("oid"))
	if err != nil {
		log.WithFields(logFields).Errorf("Error parsing outcome ID from URL: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	logFields["outcomeId"] = id
	if err = srv.Db.DeleteOutcome(uint(id)); err != nil {
		logFields["databaseMethod"] = "DeleteOutcome"
		log.WithFields(logFields).Errorf("Error deleting outcome: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
	w.WriteHeader(http.StatusNoContent)
}
