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
	log.Info("Handling facility index request")
	facilities, err := srv.Db.GetAllFacilities()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	response := models.Resource[models.Facility]{
		Data: facilities,
	}
	if err = srv.WriteResponse(w, http.StatusOK, response); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (srv *Server) HandleShowFacility(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		log.Error("GET Provider handler Error: ", err.Error())
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	facility, err := srv.Db.GetFacilityByID(id)
	if err != nil {
		log.Error("Error: ", err.Error())
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := models.Resource[models.Facility]{
		Data: make([]models.Facility, 0),
	}
	response.Data = append(response.Data, *facility)
	if err = srv.WriteResponse(w, http.StatusOK, response); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (srv *Server) HandleCreateFacility(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "HandleCreateFacility"}
	var facility models.Facility
	err := json.NewDecoder(r.Body).Decode(&facility)
	if err != nil {
		fields["error"] = err
		log.Error("Error decoding request body")
		http.Error(w, "unable to decode request body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	newFacility, err := srv.Db.CreateFacility(&facility.Name)
	if err != nil {
		fields["error"] = err
		log.WithFields(fields).Error("Error creating facility")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	response := models.Resource[models.Facility]{
		Data:    []models.Facility{*newFacility},
		Message: "Facility created successfully",
	}
	if err = srv.WriteResponse(w, http.StatusOK, response); err != nil {
		fields["error"] = err
		log.Error("Error writing response")
		srv.ErrorResponse(w, http.StatusInternalServerError, err.Error())
	}
}

func (srv *Server) HandleUpdateFacility(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "HandleUpdateFacility"}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		fields["error"] = err
		log.WithFields(fields).Error("error decoding id from path:")
		http.Error(w, "error decoding id from path", http.StatusBadRequest)
		return
	}
	fields["facilty_id"] = id
	var facility models.Facility
	err = json.NewDecoder(r.Body).Decode(&facility)
	if err != nil {
		fields["error"] = err
		log.WithFields(fields).Error("Error decoding request body")
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	if err := srv.Db.UpdateFacility(&facility.Name, uint(id)); err != nil {
		log.Error("Error updating provider platform: ", err.Error())
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	response := models.Resource[models.Facility]{
		Data:    []models.Facility{facility},
		Message: "facility successfully updated",
	}
	if err = srv.WriteResponse(w, http.StatusOK, response); err != nil {
		fields["error"] = err
		log.WithFields(fields).Error("error writing response")
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (srv *Server) HandleDeleteFacility(w http.ResponseWriter, r *http.Request) {
	fields := log.Fields{"handler": "HandleDeleteFacility"}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		fields["error"] = err
		log.WithFields(fields).Error("DELETE Provider handler Error")
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err = srv.Db.DeleteProviderPlatform(id); err != nil {
		fields["error"] = err
		log.WithFields(fields).Error("Error deleting provider platform")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
