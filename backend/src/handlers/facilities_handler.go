package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerFacilitiesRoutes() []routeDef {
	return []routeDef{
		newAdminRoute("GET /api/facilities", srv.handleIndexFacilities),
		newAdminRoute("GET /api/facilities/{id}", srv.handleShowFacility),
		newSystemAdminRoute("POST /api/facilities", srv.handleCreateFacility),
		newSystemAdminRoute("DELETE /api/facilities/{id}", srv.handleDeleteFacility),
		newSystemAdminRoute("PATCH /api/facilities/{id}", srv.handleUpdateFacility),
		newDeptAdminRoute("PUT /api/admin/facility-context/{id}", srv.handleChangeAdminFacility),
		// Facility instructors route
		featureRoute("GET /api/facilities/{facilityId}/instructors", srv.handleGetFacilityInstructors, models.ProgramAccess),
	}
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
	if !claims.canSwitchFacility() {
		return newUnauthorizedServiceError()
	}
	claims.FacilityID = uint(id)
	if err := srv.updateUserTraitsInKratos(claims); err != nil {
		log.add("facility_id", id)
		return newInternalServerServiceError(err, "error updating user traits in kratos")
	}
	return writeJsonResponse(w, http.StatusOK, "facility updated successfully")
}

func (srv *Server) handleCreateFacility(w http.ResponseWriter, r *http.Request, log sLog) error {
	var facility models.Facility
	err := json.NewDecoder(r.Body).Decode(&facility)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	err = srv.Db.CreateFacility(&facility)
	if err != nil {
		log.add("facility_name", facility.Name)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, facility)
}

func (srv *Server) handleUpdateFacility(w http.ResponseWriter, r *http.Request, log sLog) error {
	if !userIsSystemAdmin(r) {
		return newUnauthorizedServiceError()
	}
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
	if !userIsSystemAdmin(r) {
		return newUnauthorizedServiceError()
	}
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

/**
* GET: /api/facilities/{facilityId}/instructors
 */
func (srv *Server) handleGetFacilityInstructors(w http.ResponseWriter, r *http.Request, log sLog) error {
	facilityId, err := strconv.Atoi(r.PathValue("facilityId"))
	if err != nil {
		return newInvalidIdServiceError(err, "facility ID")
	}

	instructors, err := srv.Db.GetFacilityInstructors(facilityId)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	return writeJsonResponse(w, http.StatusOK, instructors)
}
