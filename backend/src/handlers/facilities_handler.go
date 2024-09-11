package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"

	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerFacilitiesRoutes() {
	srv.Mux.Handle("GET /api/facilities", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleError(srv.HandleIndexFacilities))))
	srv.Mux.Handle("GET /api/facilities/{id}", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleError(srv.HandleShowFacility))))
	srv.Mux.Handle("POST /api/facilities", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleError(srv.HandleCreateFacility))))
	srv.Mux.Handle("DELETE /api/facilities/{id}", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleError(srv.HandleDeleteFacility))))
	srv.Mux.Handle("PATCH /api/facilities/{id}", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleError(srv.HandleUpdateFacility))))
}

func (srv *Server) HandleIndexFacilities(w http.ResponseWriter, r *http.Request) error {
	fields := log.Fields{"handler": "HandleIndexFacilities"}
	facilities, err := srv.Db.GetAllFacilities()
	if err != nil {
		fields["error"] = err
		return newDatabaseServiceError(err, fields)
	}
	return writeJsonResponse(w, http.StatusOK, facilities)
}

func (srv *Server) HandleShowFacility(w http.ResponseWriter, r *http.Request) error {
	fields := log.Fields{"handler": "HandleShowFacility"}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "facility ID", fields)
	}
	fields["facility_id"] = id
	facility, err := srv.Db.GetFacilityByID(id)
	if err != nil {
		return newDatabaseServiceError(err, fields)
	}

	return writeJsonResponse(w, http.StatusOK, facility)
}

func (srv *Server) HandleCreateFacility(w http.ResponseWriter, r *http.Request) error {
	fields := log.Fields{"handler": "HandleCreateFacility"}
	var facility models.Facility
	err := json.NewDecoder(r.Body).Decode(&facility)
	if err != nil {
		fields["error"] = err
		return newJSONReqBodyServiceError(err, fields)
	}
	defer r.Body.Close()
	newFacility, err := srv.Db.CreateFacility(facility.Name)
	if err != nil {
		fields["error"] = err
		return newDatabaseServiceError(err, fields)
	}
	return writeJsonResponse(w, http.StatusOK, newFacility)
}

func (srv *Server) HandleUpdateFacility(w http.ResponseWriter, r *http.Request) error {
	fields := log.Fields{"handler": "HandleUpdateFacility"}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		fields["error"] = err
		return newInvalidIdServiceError(err, "facility ID", fields)
	}
	fields["facilty_id"] = id
	facility := make(map[string]interface{}, 0)
	err = json.NewDecoder(r.Body).Decode(&facility)
	if err != nil {
		fields["error"] = err
		return newJSONReqBodyServiceError(err, fields)
	}
	defer r.Body.Close()
	toReturn, err := srv.Db.UpdateFacility(facility["name"].(string), uint(id))
	if err != nil {
		fields["error"] = err
		return newDatabaseServiceError(err, fields)
	}
	return writeJsonResponse(w, http.StatusOK, *toReturn)
}

func (srv *Server) HandleDeleteFacility(w http.ResponseWriter, r *http.Request) error {
	fields := log.Fields{"handler": "HandleDeleteFacility"}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		fields["error"] = err
		return newInvalidIdServiceError(err, "facility ID", fields)
	}
	if err = srv.Db.DeleteFacility(id); err != nil {
		fields["error"] = err
		return newDatabaseServiceError(err, fields)
	}
	return writeJsonResponse(w, http.StatusNoContent, "facility deleted successfully")
}
