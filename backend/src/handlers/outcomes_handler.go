package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerOutcomesRoutes() {
	srv.Mux.Handle("GET /api/users/{id}/outcomes", srv.applyMiddleware(http.HandlerFunc(srv.HandleError(srv.HandleGetOutcomes))))
	srv.Mux.Handle("POST /api/users/{id}/outcomes", srv.applyMiddleware(http.HandlerFunc(srv.HandleError(srv.HandleCreateOutcome))))
	srv.Mux.Handle("PATCH /api/users/{id}/outcomes/{oid}", srv.applyMiddleware(http.HandlerFunc(srv.HandleError(srv.HandleUpdateOutcome))))
	srv.Mux.Handle("DELETE /api/users/{id}/outcomes/{oid}", srv.applyMiddleware(http.HandlerFunc(srv.HandleError(srv.HandleDeleteOutcome))))
}

/****
 * @Query Params:
 * ?type=: "certificate", "grade", "pathway_completion", "college_credit"
 ****/
func (srv *Server) HandleGetOutcomes(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleGetOutcomes")
	page, perPage := srv.GetPaginationInfo(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}

	// Get vars from query param
	order := r.URL.Query().Get("order")
	orderBy := r.URL.Query().Get("order_by")
	typeString := r.URL.Query().Get("type")
	outcomeType := models.OutcomeType(typeString)

	total, outcome, err := srv.Db.GetOutcomesForUser(uint(id), page, perPage, order, orderBy, outcomeType)
	if err != nil {
		fields.add("UserID", id)
		fields.add("outcomeType", outcomeType)
		return newDatabaseServiceError(err)
	}
	meta := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, outcome, meta)
}

func (srv *Server) HandleCreateOutcome(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleCreateOutcome")
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	fields.add("userId", id)
	outcome := &models.Outcome{}
	err = json.NewDecoder(r.Body).Decode(&outcome)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	if outcome.UserID == 0 {
		outcome.UserID = uint(id)
	}
	if outcome, err = srv.Db.CreateOutcome(outcome); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, *outcome)
}

func (srv *Server) HandleUpdateOutcome(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleUpdateOutcome")
	id, err := strconv.Atoi(r.PathValue("oid"))
	if err != nil {
		return newInvalidIdServiceError(err, "outcome ID")
	}
	fields.add("outcomeId", id)
	uid, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	fields.add("userId", uid)
	outcome := models.Outcome{}
	err = json.NewDecoder(r.Body).Decode(&outcome)
	defer r.Body.Close()
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	if outcome.UserID == 0 {
		outcome.UserID = uint(uid)
	}
	updatedOutcome, err := srv.Db.UpdateOutcome(&outcome, uint(id))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, *updatedOutcome)
}

func (srv *Server) HandleDeleteOutcome(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleDeleteOutcome")
	id, err := strconv.Atoi(r.PathValue("oid"))
	if err != nil {
		return newInvalidIdServiceError(err, "outcome ID")
	}
	if err = srv.Db.DeleteOutcome(uint(id)); err != nil {
		fields.add("outcomeId", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusNoContent, "Outcome deleted successfully")
}
