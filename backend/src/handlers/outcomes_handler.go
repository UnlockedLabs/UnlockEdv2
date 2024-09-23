package handlers

import (
	"UnlockEdv2/src/models"
	"net/http"
	"strconv"
)

func (srv *Server) registerOutcomesRoutes() {
	srv.Mux.Handle("GET /api/users/{id}/outcomes", srv.applyMiddleware(srv.handleGetOutcomes))
}

/****
 * @Query Params:
 * ?type=: "certificate", "grade", "pathway_completion", "college_credit"
 ****/
func (srv *Server) handleGetOutcomes(w http.ResponseWriter, r *http.Request, log sLog) error {
	page, perPage := srv.getPaginationInfo(r)
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
		log.add("userId", id)
		log.add("outcomeType", outcomeType)
		return newDatabaseServiceError(err)
	}
	meta := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, outcome, meta)
}
