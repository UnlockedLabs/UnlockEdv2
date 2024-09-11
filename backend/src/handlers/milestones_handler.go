package handlers

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerMilestonesRoutes() {
	srv.Mux.Handle("GET /api/milestones", srv.applyMiddleware(srv.HandleError(srv.HandleIndexMilestones)))
	srv.Mux.Handle("POST /api/milestones", srv.ApplyAdminMiddleware(srv.HandleError(srv.HandleCreateMilestone)))
	srv.Mux.Handle("DELETE /api/milestones", srv.ApplyAdminMiddleware(srv.HandleError(srv.HandleDeleteMilestone)))
	srv.Mux.Handle("PATCH /api/milestones/{id}", srv.ApplyAdminMiddleware(srv.HandleError(srv.HandleUpdateMilestone)))
}

func (srv *Server) HandleIndexMilestones(w http.ResponseWriter, r *http.Request) error {
	search := r.URL.Query().Get("search")
	orderBy := r.URL.Query().Get("order_by")
	page, perPage := srv.GetPaginationInfo(r)
	var milestones []database.MilestoneResponse
	err := error(nil)
	total := int64(0)
	if !srv.UserIsAdmin(r) {
		userId := r.Context().Value(ClaimsKey).(*Claims).UserID
		total, milestones, err = srv.Db.GetMilestonesForUser(page, perPage, userId)
		if err != nil {
			return newDatabaseServiceError(err, nil)
		}
	} else {
		total, milestones, err = srv.Db.GetMilestones(page, perPage, search, orderBy)
		if err != nil {
			return newDatabaseServiceError(err, nil)
		}
	}
	last := srv.CalculateLast(total, perPage)
	paginationData := models.PaginationMeta{
		PerPage:     perPage,
		LastPage:    int(last),
		CurrentPage: page,
		Total:       total,
	}
	return writePaginatedResponse(w, http.StatusOK, milestones, paginationData)
}

func (srv *Server) HandleCreateMilestone(w http.ResponseWriter, r *http.Request) error {
	miles := &models.Milestone{}
	if err := json.NewDecoder(r.Body).Decode(miles); err != nil {
		return newJSONReqBodyServiceError(err, nil)
	}
	defer r.Body.Close()
	if _, err := srv.Db.CreateMilestone(miles); err != nil {
		return newDatabaseServiceError(err, nil)
	}
	return writeJsonResponse(w, http.StatusCreated, miles)
}

func (srv *Server) HandleDeleteMilestone(w http.ResponseWriter, r *http.Request) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "milestone ID", nil)
	}
	if err := srv.Db.DeleteMilestone(id); err != nil {
		return newDatabaseServiceError(err, nil)
	}
	return writeJsonResponse(w, http.StatusOK, "Milestone deleted successfully")
}

func (srv *Server) HandleUpdateMilestone(w http.ResponseWriter, r *http.Request) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Info("No ID provided in URL, checking request body json")
	}
	miles := &models.Milestone{}
	if err := json.NewDecoder(r.Body).Decode(miles); err != nil {
		return newJSONReqBodyServiceError(err, nil)
	}
	defer r.Body.Close()
	msId := 0
	if id != 0 {
		msId = int(id)
	} else if miles.ID != 0 {
		msId = int(miles.ID)
	} else {
		return newBadRequestServiceError(errors.New("no ID provided in URL or request body"), "No ID provided in URL or request body", nil)
	}
	toUpdate, err := srv.Db.GetMilestoneByID(msId)
	if err != nil {
		return newDatabaseServiceError(err, nil)
	}
	models.UpdateStruct(&toUpdate, &miles)
	if _, err := srv.Db.UpdateMilestone(toUpdate); err != nil {
		return newDatabaseServiceError(err, nil)
	}
	return writeJsonResponse(w, http.StatusOK, toUpdate)
}
