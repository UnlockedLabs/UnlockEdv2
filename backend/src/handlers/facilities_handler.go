package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerFacilitiesRoutes() {
	srv.Mux.Handle("GET /api/facilities", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleError(srv.HandleIndexFacilities))))
	srv.Mux.Handle("GET /api/facilities/{id}", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleError(srv.HandleShowFacility))))
	srv.Mux.Handle("POST /api/facilities", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleError(srv.HandleCreateFacility))))
	srv.Mux.Handle("DELETE /api/facilities/{id}", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleError(srv.HandleDeleteFacility))))
	srv.Mux.Handle("PATCH /api/facilities/{id}", srv.ApplyAdminMiddleware(http.HandlerFunc(srv.HandleError(srv.HandleUpdateFacility))))
}

func (srv *Server) HandleIndexFacilities(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleIndexFacilities")
	facilities, err := srv.Db.GetAllFacilities()
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, facilities)
}

func (srv *Server) HandleShowFacility(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleShowFacility")
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "facility ID")
	}
	fields.add("facility_id", id)
	facility, err := srv.Db.GetFacilityByID(id)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	return writeJsonResponse(w, http.StatusOK, facility)
}

func (srv *Server) HandleCreateFacility(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleCreateFacility")
	var facility models.Facility
	err := json.NewDecoder(r.Body).Decode(&facility)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()
	newFacility, err := srv.Db.CreateFacility(facility.Name)
	if err != nil {
		fields.add("facility.Name", facility.Name)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, newFacility)
}

func (srv *Server) HandleUpdateFacility(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleUpdateFacility")
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "facility ID")
	}
	fields.add("facilty_id", id)
	facility := make(map[string]interface{}, 0)
	err = json.NewDecoder(r.Body).Decode(&facility)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()
	toReturn, err := srv.Db.UpdateFacility(facility["name"].(string), uint(id))
	if err != nil {
		fields.add("facilityName", facility["name"])
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, *toReturn)
}

func (srv *Server) HandleDeleteFacility(w http.ResponseWriter, r *http.Request, fields LogFields) error {
	fields.add("handler", "HandleDeleteFacility")
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "facility ID")
	}
	if err = srv.Db.DeleteFacility(id); err != nil {
		fields.add("facilityId", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusNoContent, "facility deleted successfully")
}
