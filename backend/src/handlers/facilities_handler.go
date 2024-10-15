package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerFacilitiesRoutes() {
	srv.Mux.Handle("GET /api/facilities", srv.applyAdminMiddleware(srv.handleIndexFacilities))
	srv.Mux.Handle("GET /api/facilities/{id}", srv.applyAdminMiddleware(srv.handleShowFacility))
	srv.Mux.Handle("POST /api/facilities", srv.applyAdminMiddleware(srv.handleCreateFacility))
	srv.Mux.Handle("DELETE /api/facilities/{id}", srv.applyAdminMiddleware(srv.handleDeleteFacility))
	srv.Mux.Handle("PATCH /api/facilities/{id}", srv.applyAdminMiddleware(srv.handleUpdateFacility))
	srv.Mux.Handle("PUT /api/admin/facility-context/{id}", srv.applyAdminMiddleware(srv.handleChangeAdminFacility))
}

/**
* GET: /api/facility/{id}
**/
func (srv *Server) handleIndexFacilities(w http.ResponseWriter, r *http.Request, log sLog) error {
	page, perPage := srv.getPaginationInfo(r)
	total, facilities, err := srv.Db.GetAllFacilities(page, perPage)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	paginationData := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, facilities, paginationData)
}

/**
* GET: /api/facility/{id}
**/
func (srv *Server) handleShowFacility(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "facility ID")
	}
	log.add("facility_id", id)
	facility, err := srv.Db.GetFacilityByID(id)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	return writeJsonResponse(w, http.StatusOK, facility)
}

func (srv *Server) handleChangeAdminFacility(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "facility ID")
	}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	claims.FacilityID = uint(id)
	if err := srv.updateUserTraitsInKratos(claims); err != nil {
		log.add("facilityId", id)
		return newInternalServerServiceError(err, "error updating user traits in kratos")
	}
	w.WriteHeader(http.StatusOK)
	return nil
}

func (srv *Server) handleCreateFacility(w http.ResponseWriter, r *http.Request, log sLog) error {
	var facility models.Facility
	err := json.NewDecoder(r.Body).Decode(&facility)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()

	err = srv.Db.CreateFacility(&facility)
	if err != nil {
		log.add("facility.Name", facility.Name)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, facility)
}

func (srv *Server) handleUpdateFacility(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "facility ID")
	}
	log.add("facilty_id", id)
	var facility models.Facility
	err = json.NewDecoder(r.Body).Decode(&facility)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	defer r.Body.Close()
	err = srv.Db.UpdateFacility(&facility, uint(id))
	if err != nil {
		log.add("facilityName", facility.Name)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "facility updated successfully")
}

/**
* DELETE: /api/facility/{id}
 */
func (srv *Server) handleDeleteFacility(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "facility ID")
	}
	if err = srv.Db.DeleteFacility(id); err != nil {
		log.add("facilityId", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusNoContent, "facility deleted successfully")
}
