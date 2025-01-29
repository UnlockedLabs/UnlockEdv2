package handlers

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
)

func (srv *Server) registerMilestonesRoutes() []routeDef {
	axx := []models.FeatureAccess{models.ProviderAccess}
	return []routeDef{
		{"GET /api/milestones", srv.handleIndexMilestones, false, axx},
		{"POST /api/milestones", srv.handleCreateMilestone, true, axx},
		{"DELETE /api/milestones/{id}", srv.handleDeleteMilestone, true, axx},
		{"PATCH /api/milestones/{id}", srv.handleUpdateMilestone, true, axx},
	}
}

func (srv *Server) handleIndexMilestones(w http.ResponseWriter, r *http.Request, log sLog) error {
	var milestones []database.MilestoneResponse
	args := srv.getQueryContext(r)
	err := error(nil)
	if !userIsAdmin(r) {
		milestones, err = srv.Db.GetMilestonesForUser(&args)
		if err != nil {
			log.add("user_id", args.UserID)
			return newDatabaseServiceError(err)
		}
	} else {
		milestones, err = srv.Db.GetMilestones(&args)
		if err != nil {
			log.add("search", args.Search)
			return newDatabaseServiceError(err)
		}
	}
	return writePaginatedResponse(w, http.StatusOK, milestones, args.IntoMeta())
}

func (srv *Server) handleCreateMilestone(w http.ResponseWriter, r *http.Request, log sLog) error {
	miles := &models.Milestone{}
	if err := json.NewDecoder(r.Body).Decode(miles); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()
	if _, err := srv.Db.CreateMilestone(miles); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, miles)
}

func (srv *Server) handleDeleteMilestone(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "milestone ID")
	}
	if err := srv.Db.DeleteMilestone(id); err != nil {
		log.add("milestoneId", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusNoContent, "Milestone deleted successfully")
}

func (srv *Server) handleUpdateMilestone(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.info("No ID provided in URL, checking request body json")
	}
	log.add("milestoneId", id)
	miles := &models.Milestone{}
	if err := json.NewDecoder(r.Body).Decode(miles); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()
	msId := 0
	if id != 0 {
		msId = int(id)
	} else if miles.ID != 0 {
		msId = int(miles.ID)
	} else {
		return newBadRequestServiceError(errors.New("no ID provided in URL or request body"), "No ID provided in URL or request body")
	}
	toUpdate, err := srv.Db.GetMilestoneByID(msId)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	models.UpdateStruct(&toUpdate, &miles)
	if _, err := srv.Db.UpdateMilestone(toUpdate); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, toUpdate)
}
