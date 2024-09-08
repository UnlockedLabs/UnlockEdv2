package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerFacilitiesRoutes() {
	srv.Mux.Handle("GET /api/facilities", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleIndexFacilities)))
	srv.Mux.Handle("GET /api/facilities/{id}", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleShowFacility)))
	srv.Mux.Handle("POST /api/facilities", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleCreateFacility)))
	srv.Mux.Handle("DELETE /api/facilities/{id}", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleDeleteFacility)))
	srv.Mux.Handle("PATCH /api/facilities/{id}", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleUpdateFacility)))
}

func (srv *Server) HandleIndexFacilities(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "HandleIndexFacilities"}
	facilities, err := srv.Db.GetAllFacilities()
	if err != nil {
		fields["error"] = err
		log.WithFields(fields).Errorln("error fetching facilities from database")
		srv.ErrorResponse(w, http.StatusInternalServerError, "error fetching facilities from database")
		return
	}
	writeJsonResponse(w, http.StatusOK, facilities)
}

func (srv *Server) HandleShowFacility(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "HandleShowFacility"}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Error("GET Provider handler Error: ", err.Error())
		srv.ErrorResponse(w, http.StatusBadRequest, "error decoding request body")
	}
	fields["facility_id"] = id
	facility, err := srv.Db.GetFacilityByID(id)
	if err != nil {
		log.WithFields(fields).Error("Error: ", err.Error())
		srv.ErrorResponse(w, http.StatusNotFound, "error fetching facility with that ID")
		return
	}

	writeJsonResponse(w, http.StatusOK, facility)
}

func (srv *Server) HandleCreateFacility(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "HandleCreateFacility"}
	var facility models.Facility
	err := json.NewDecoder(r.Body).Decode(&facility)
	if err != nil {
		fields["error"] = err
		log.WithFields(fields).Error("Error decoding request body")
		srv.ErrorResponse(w, http.StatusBadRequest, "error decoding request body")
		return
	}
	defer r.Body.Close()
	newFacility, err := srv.Db.CreateFacility(facility.Name)
	if err != nil {
		fields["error"] = err
		log.WithFields(fields).Error("Error creating facility")
		srv.ErrorResponse(w, http.StatusInternalServerError, "facility couldn't be created in the database")
		return
	}
	writeJsonResponse(w, http.StatusOK, newFacility)
}

func (srv *Server) HandleUpdateFacility(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "HandleUpdateFacility"}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		fields["error"] = err
		log.WithFields(fields).Error("error decoding id from path:")
		srv.ErrorResponse(w, http.StatusBadRequest, "error decoding provided ID")
		return
	}
	fields["facilty_id"] = id
	facility := make(map[string]interface{}, 0)
	err = json.NewDecoder(r.Body).Decode(&facility)
	if err != nil {
		fields["error"] = err
		log.WithFields(fields).Error("Error decoding request body")
		srv.ErrorResponse(w, http.StatusBadRequest, "error decoding request body")
		return
	}
	defer r.Body.Close()
	toReturn, err := srv.Db.UpdateFacility(facility["name"].(string), uint(id))
	if err != nil {
		fields["error"] = err
		log.WithFields(fields).Error("Error updating facility")
		srv.ErrorResponse(w, http.StatusInternalServerError, "Error updating facility, please check the values provided")
		return
	}
	writeJsonResponse(w, http.StatusOK, *toReturn)
}

func (srv *Server) HandleDeleteFacility(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "HandleDeleteFacility"}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		fields["error"] = err
		log.WithFields(fields).Error("error parsing value from path")
		srv.ErrorResponse(w, http.StatusBadRequest, "Error deleting facility, invalid ID provided")
		return
	}
	if err = srv.Db.DeleteFacility(id); err != nil {
		fields["error"] = err
		log.WithFields(fields).Error("Error deleting facility")
		srv.ErrorResponse(w, http.StatusInternalServerError, "Error deleting facility")
		return
	}
	writeJsonResponse(w, http.StatusNoContent, "facility deleted successfully")
}
