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
		http.Error(w, err.Error(), http.StatusBadRequest)
	}

	// Get vars from query params
	typeString := r.URL.Query().Get("type")
	order := r.URL.Query().Get("order")
	orderBy := r.URL.Query().Get("order_by")
	outcomeType := models.OutcomeType(typeString)

	total, outcome, err := srv.Db.GetOutcomesForUser(uint(id), page, perPage, order, orderBy, outcomeType)
	if err != nil {
		log.Error("handler: getOutcomes: ", err.Error())
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	response := models.PaginatedResource[models.Outcome]{}
	response.Meta = models.NewPaginationInfo(page, perPage, total)
	response.Data = outcome
	srv.WriteResponse(w, http.StatusOK, response)
}

func (srv *Server) HandleCreateOutcome(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Error("handler: createOutcome: ", err.Error())
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	outcome := &models.Outcome{}
	err = json.NewDecoder(r.Body).Decode(&outcome)
	if err != nil {
		log.Error("handler: createOutcome: ", err.Error())
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if outcome.UserID == 0 {
		outcome.UserID = uint(id)
	}
	if outcome, err = srv.Db.CreateOutcome(outcome); err != nil {
		log.Error("handler: createOutcome: ", err.Error())
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (srv *Server) HandleUpdateOutcome(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("oid"))
	if err != nil {
		log.Error("handler: updateOutcome: ", err.Error())
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	uid, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Error("handler: updateOutcome: ", err.Error())
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	outcome := models.Outcome{}
	err = json.NewDecoder(r.Body).Decode(&outcome)
	defer r.Body.Close()
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if outcome.UserID == 0 {
		outcome.UserID = uint(uid)
	}
	updatedOutcome, err := srv.Db.UpdateOutcome(&outcome, uint(id))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	response := models.Resource[models.Outcome]{}
	response.Data = append(response.Data, *updatedOutcome)
	srv.WriteResponse(w, http.StatusOK, response)
}

func (srv *Server) HandleDeleteOutcome(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("oid"))
	if err != nil {
		log.Error("handler: deleteOutcome: ", err.Error())
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	if err = srv.Db.DeleteOutcome(uint(id)); err != nil {
		log.Error("handler: deleteOutcome: ", err.Error())
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
	w.WriteHeader(http.StatusNoContent)
}
