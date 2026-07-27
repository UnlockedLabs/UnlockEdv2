package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerFacilitiesRoutes() []routeDef {
	axx := models.ProgramAccess
	return []routeDef{
		newAdminRoute("GET /api/facilities", srv.handleIndexFacilities),
		newAdminRoute("GET /api/facilities/{id}", srv.handleShowFacility),
		newDeptAdminRoute("POST /api/facilities", srv.handleCreateFacility),
		newDeptAdminRoute("GET /api/facilities/{id}/delete-check", srv.handleGetFacilityDeleteCheck),
		newDeptAdminRoute("DELETE /api/facilities/{id}", srv.handleDeleteFacility),
		newDeptAdminRoute("PATCH /api/facilities/{id}", srv.handleUpdateFacility),
		adminFeatureRoute("GET /api/rooms", srv.handleGetRooms, axx),
		adminFeatureRoute("POST /api/rooms", srv.handleCreateRoom, axx),
		adminValidatedFeatureRoute("GET /api/facilities/{facilityId}/instructors",
			srv.handleGetFacilityInstructors, models.ProgramAccess, FacilityAdminResolver("facilities", "facilityId")),
	}
}

/**
* GET: /api/facility/{id}
**/
func (srv *Server) handleIndexFacilities(w http.ResponseWriter, r *http.Request, log sLog) error {
	args := srv.getQueryContext(r)
	facilities, err := srv.Db.GetAllFacilitiesWithStats(&args)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, facilities, args.IntoMeta())
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

func (srv *Server) handleCreateFacility(w http.ResponseWriter, r *http.Request, log sLog) error {
	var facility models.Facility
	err := json.NewDecoder(r.Body).Decode(&facility)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	err = srv.WithUserContext(r).CreateFacility(&facility)
	if err != nil {
		log.add("facility_name", facility.Name)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, facility)
}

func (srv *Server) handleUpdateFacility(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "facility ID")
	}
	log.add("facility_id", id)
	var facility models.Facility
	err = json.NewDecoder(r.Body).Decode(&facility)
	if err != nil {
		return newJSONReqBodyServiceError(err)
	}
	err = srv.WithUserContext(r).UpdateFacility(&facility, uint(id))
	if err != nil {
		log.add("facilityName", facility.Name)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, "facility updated successfully")
}

/**
* GET: /api/facilities/{id}/delete-check
* Preflight used by the UI to decide whether the delete control is enabled and,
* when it is not, what is blocking the delete.
 */
func (srv *Server) handleGetFacilityDeleteCheck(w http.ResponseWriter, r *http.Request, log sLog) error {
	if !userCanManageFacilities(r) {
		return newUnauthorizedServiceError()
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "facility ID")
	}
	log.add("facility_id", id)
	blockers, err := srv.Db.FacilityBlockingChildren(id)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	payload := struct {
		CanDelete bool                            `json:"can_delete"`
		Blockers  models.FacilityBlockingChildren `json:"blockers"`
	}{
		CanDelete: !blockers.HasAny(),
		Blockers:  blockers,
	}
	return writeJsonResponse(w, http.StatusOK, payload)
}

/**
* DELETE: /api/facility/{id}
* A facility may only be deleted when it has no associated records. The guard is
* re-checked here (not only in the preflight) so a stale UI cannot force a delete.
 */
func (srv *Server) handleDeleteFacility(w http.ResponseWriter, r *http.Request, log sLog) error {
	if !userCanManageFacilities(r) {
		return newUnauthorizedServiceError()
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "facility ID")
	}
	log.add("facilityId", id)
	blockers, err := srv.Db.FacilityBlockingChildren(id)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if blockers.HasAny() {
		log.info("facility delete blocked by associated records")
		return writeFacilityDeleteConflictResponse(w, "cannot delete: facility has associated records", blockers)
	}
	if err = srv.WithUserContext(r).DeleteFacility(id); err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusNoContent, "facility deleted successfully")
}

func (srv *Server) handleGetRooms(w http.ResponseWriter, r *http.Request, log sLog) error {
	facilityID := srv.facilityScopedQueryContext(r).FacilityID
	log.add("facility_id", facilityID)
	rooms, err := srv.Db.GetRoomsForFacility(facilityID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, rooms)
}

func (srv *Server) handleCreateRoom(w http.ResponseWriter, r *http.Request, log sLog) error {
	facilityID, err := srv.requireFacilityID(r)
	if err != nil {
		return err
	}
	var room models.Room
	if err := json.NewDecoder(r.Body).Decode(&room); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	room.FacilityID = facilityID
	log.add("facility_id", facilityID)
	log.add("room_name", room.Name)
	created, err := srv.Db.CreateRoom(&room)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, created)
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
