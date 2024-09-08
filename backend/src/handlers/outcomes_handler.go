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
	page, perPage := srv.GetPaginationInfo(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Error("handler: getOutcomes: ", err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid user id")
	}

	// Get vars from query param
	order := r.URL.Query().Get("order")
	orderBy := r.URL.Query().Get("order_by")
	typeString := r.URL.Query().Get("type")
	outcomeType := models.OutcomeType(typeString)

	total, outcome, err := srv.Db.GetOutcomesForUser(uint(id), page, perPage, order, orderBy, outcomeType)
	if err != nil {
		log.Error("handler: getOutcomes: ", err.Error())
		srv.ErrorResponse(w, http.StatusInternalServerError, "Error fetching outcomes from database")
		return
	}
	meta := models.NewPaginationInfo(page, perPage, total)
	writePaginatedResponse(w, http.StatusOK, outcome, meta)
}

func (srv *Server) HandleCreateOutcome(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "createOutcome"}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("error parsing id from path")
		srv.ErrorResponse(w, http.StatusBadRequest, "Error creating outcome, invalid form")
		return
	}
	outcome := &models.Outcome{}
	err = json.NewDecoder(r.Body).Decode(&outcome)
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("error parsing id from path")
		srv.ErrorResponse(w, http.StatusBadRequest, "Error creating outcome, invalid form")
		return
	}
	if outcome.UserID == 0 {
		outcome.UserID = uint(id)
	}
	if outcome, err = srv.Db.CreateOutcome(outcome); err != nil {
		log.WithFields(fields).Error("error creating outcome in the database")
		srv.ErrorResponse(w, http.StatusBadRequest, "Error creating outcome, invalid form")
		return
	}
	writeJsonResponse(w, http.StatusCreated, *outcome)
}

func (srv *Server) HandleUpdateOutcome(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "updateOutcome"}
	id, err := strconv.Atoi(r.PathValue("oid"))
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("handler: updateOutcome: ", err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, "Error updating outcome, invalid outcome ID")
		return
	}
	uid, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Error("handler: updateOutcome: ", err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, "Error updating outcome, invalid user ID")
		return
	}
	outcome := models.Outcome{}
	err = json.NewDecoder(r.Body).Decode(&outcome)
	defer r.Body.Close()
	if err != nil {
		fields["error"] = err.Error()
		log.WithFields(fields).Errorln("Error decoding request body")
		srv.ErrorResponse(w, http.StatusBadRequest, "Error updating outcome, invalid form")
		return
	}
	if outcome.UserID == 0 {
		outcome.UserID = uint(uid)
	}
	updatedOutcome, err := srv.Db.UpdateOutcome(&outcome, uint(id))
	if err != nil {
		log.WithFields(fields).Errorln("Error updating outcome in the database")
		srv.ErrorResponse(w, http.StatusBadRequest, "Error updating outcome")
		return
	}
	writeJsonResponse(w, http.StatusOK, *updatedOutcome)
}

func (srv *Server) HandleDeleteOutcome(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("oid"))
	if err != nil {
		log.Error("handler: deleteOutcome: ", err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, "Invalid outcome id")
	}
	if err = srv.Db.DeleteOutcome(uint(id)); err != nil {
		log.Error("handler: deleteOutcome: ", err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, "Error deleting outcome, invalid outcome id")
	}
	writeJsonResponse(w, http.StatusNoContent, "Outcome deleted successfully")
}
