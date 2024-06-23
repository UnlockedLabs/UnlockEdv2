package handlers

import (
	"UnlockEdv2/src/database"
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerMilestonesRoutes() {
	srv.Mux.Handle("GET /api/milestones", srv.applyMiddleware(http.HandlerFunc(srv.HandleIndexMilestones)))
	srv.Mux.Handle("POST /api/milestones", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleCreateMilestone)))
	srv.Mux.Handle("DELETE /api/milestones", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleDeleteMilestone)))
	srv.Mux.Handle("PATCH /api/milestones/{id}", srv.applyAdminMiddleware(http.HandlerFunc(srv.HandleUpdateMilestone)))
}

func (srv *Server) HandleIndexMilestones(w http.ResponseWriter, r *http.Request) {
	userId := r.Context().Value(ClaimsKey).(*Claims).UserID
	logFields := log.Fields{
		"handler": "HandleIndexMilestones",
		"route":   "GET /api/milestones",
		"user_id": userId,
	}
	search := r.URL.Query().Get("search")
	orderBy := r.URL.Query().Get("order_by")
	page, perPage := srv.GetPaginationInfo(r)
	var milestones []database.MilestoneResponse
	err := error(nil)
	total := int64(0)
	if !srv.UserIsAdmin(r) {
		total, milestones, err = srv.Db.GetMilestonesForUser(page, perPage, userId)
		if err != nil {
			logFields["databaseMethod"] = "GetMilestonesForUser"
			log.WithFields(logFields).Debug("Error getting user milestones: ", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	} else {
		total, milestones, err = srv.Db.GetMilestones(page, perPage, search, orderBy)
		if err != nil {
			logFields["databaseMethod"] = "GetMilestones"
			log.WithFields(logFields).Errorf("Error getting milestones: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}
	last := srv.CalculateLast(total, perPage)
	paginationData := models.PaginationMeta{
		PerPage:     perPage,
		LastPage:    int(last),
		CurrentPage: page,
		Total:       total,
	}
	response := models.PaginatedResource[database.MilestoneResponse]{
		Meta: paginationData,
		Data: milestones,
	}
	if err = srv.WriteResponse(w, http.StatusOK, response); err != nil {
		log.WithFields(logFields).Errorf("Error writing response for indexing milestones: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
	}
}

func (srv *Server) HandleCreateMilestone(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleCreateMilestone",
		"route":   "POST /api/milestones",
	}
	miles := &models.Milestone{}
	if err := json.NewDecoder(r.Body).Decode(miles); err != nil {
		log.WithFields(logFields).Errorf("Error decoding request body: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	defer r.Body.Close()
	if _, err := srv.Db.CreateMilestone(miles); err != nil {
		logFields["databaseMethod"] = "CreateMilestone"
		log.WithFields(logFields).Errorf("Error creating milestone: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := srv.WriteResponse(w, http.StatusCreated, miles); err != nil {
		log.WithFields(logFields).Errorf("Error writing response for creating milestone: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
}

func (srv *Server) HandleDeleteMilestone(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleDeleteMilestone",
		"route":   "DELETE /api/milestones",
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.WithFields(logFields).Errorf("Error parsing ID from URL: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	logFields["milestoneId"] = id
	if err := srv.Db.DeleteMilestone(id); err != nil {
		logFields["databaseMethod"] = "DeleteMilestone"
		log.WithFields(logFields).Errorf("Error deleting milestone: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (srv *Server) HandleUpdateMilestone(w http.ResponseWriter, r *http.Request) {
	logFields := log.Fields{
		"handler": "HandleUpdateMilestone",
		"route":   "PATCH /api/milestones/{id}",
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Info("No ID provided in URL, checking request body json")
	}
	miles := &models.Milestone{}
	if err := json.NewDecoder(r.Body).Decode(miles); err != nil {
		log.WithFields(logFields).Errorf("Error decoding request body: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	defer r.Body.Close()
	msId := 0
	if id != 0 {
		msId = int(id)
		logFields["milestoneId"] = id
	} else if miles.ID != 0 {
		msId = int(miles.ID)
		logFields["milestoneId"] = miles.ID
	} else {
		srv.ErrorResponse(w, http.StatusBadRequest, "No ID provided in URL or request body")
	}
	toUpdate, err := srv.Db.GetMilestoneByID(msId)
	if err != nil {
		logFields["databaseMethod"] = "GetMilestoneByID"
		log.WithFields(logFields).Errorf("Error getting milestone by ID: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
	models.UpdateStruct(&toUpdate, &miles)
	if _, err := srv.Db.UpdateMilestone(toUpdate); err != nil {
		logFields["databaseMethod"] = "UpdateMilestone"
		log.WithFields(logFields).Errorf("Error updating milestone: %v", err)
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := srv.WriteResponse(w, http.StatusOK, toUpdate); err != nil {
		log.WithFields(logFields).Errorf("Error writing response for update to milestones: %v", err)
		srv.ErrorResponse(w, http.StatusBadRequest, err.Error())
		return
	}
}
