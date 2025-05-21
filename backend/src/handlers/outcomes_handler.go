package handlers

import (
	"UnlockEdv2/src/models"
	"net/http"
	"strconv"
)

func (srv *Server) registerOutcomesRoutes() []routeDef {
	return []routeDef{
		featureRoute("GET /api/users/{id}/outcomes", srv.handleGetOutcomes, models.ProviderAccess),
	}
}

/****
 * @Query Params:
 * ?type=: "certificate", "grade", "pathway_completion", "college_credit"
 ****/
func (srv *Server) handleGetOutcomes(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	typeString := r.URL.Query().Get("type")
	outcomeType := models.OutcomeType(typeString)
	args := srv.getQueryContext(r)
	args.UserID = uint(id)
	outcome, err := srv.Db.GetOutcomesForUser(&args, outcomeType)
	if err != nil {
		log.add("user_id", id)
		log.add("type", outcomeType)
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, outcome, args.IntoMeta())
}
