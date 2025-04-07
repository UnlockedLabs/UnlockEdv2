package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerProgramClassEnrollmentsRoutes() []routeDef {
	axx := models.Feature(models.ProviderAccess)
	return []routeDef{
		{"GET /api/program-classes/{id}/enrollments", srv.handleIndexProgramClassEnrollments, true, axx},
		{"GET /api/program-classes/{id}/enrollments/{e_id}", srv.handleGetProgramClassEnrollments, true, axx},
		{"POST /api/program-classes/{id}/enrollments", srv.handleEnrollUsers, true, axx},
		{"DELETE /api/program-classes/{id}/enrollments/{e_id}", srv.handleDeleteProgramClassEnrollments, true, axx},
		{"PATCH /api/program-classes/{id}/enrollments/{e_id}", srv.handleUpdateProgramClassEnrollments, true, axx},
		{"GET /api/program-classes/{id}/enrollments/{e_id}/attendance", srv.handleGetProgramClassEnrollmentsAttendance, true, axx},
		{"GET /api/users/{id}/class-enrollments", srv.handleGetUserEnrollments, false, axx},
	}
}

/* this gets all enrollments for an entire facility.. may rarely be called */
func (srv *Server) handleIndexProgramClassEnrollments(w http.ResponseWriter, r *http.Request, log sLog) error {
	facilityID := r.Context().Value(ClaimsKey).(*Claims).FacilityID
	log.add("facility_id", facilityID)
	page, perPage := srv.getPaginationInfo(r)
	total, enrollemnts, err := srv.Db.GetProgramClassEnrollmentsForFacility(page, perPage, facilityID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	paginationData := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, enrollemnts, paginationData)
}

func (srv *Server) handleGetProgramClassEnrollments(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("e_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class enrollment ID")
	}
	log.add("class_enrollment_id", id)
	enrollment, err := srv.Db.GetProgramClassEnrollmentsByID(id)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, enrollment)
}

func (srv *Server) handleGetUserEnrollments(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	log.add("user_id", id)
	args := srv.getQueryContext(r)
	if !srv.canViewUserData(r, id) {
		return newUnauthorizedServiceError()
	}
	enrollemnts, err := srv.Db.GetProgramClassEnrollmentsForUser(&args)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, enrollemnts, args.IntoMeta())
}

func (srv *Server) handleEnrollUsers(w http.ResponseWriter, r *http.Request, log sLog) error {
	classID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	log.add("class_id", classID)
	info := struct {
		UserIDs []int `json:"user_ids"`
		ClassID int   `json:"class_id"`
	}{}
	if err = json.NewDecoder(r.Body).Decode(&info); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	log.info("enrolling users")
	err = srv.Db.CreateProgramClassEnrollments(classID, info.UserIDs)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, "user enrolled")
}

func (srv *Server) handleDeleteProgramClassEnrollments(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("e_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program class enrollment ID")
	}
	log.add("class_enrollment_id", id)
	err = srv.Db.DeleteProgramClassEnrollments(id)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	log.info("class enrollment deleted")
	return writeJsonResponse(w, http.StatusNoContent, "Class enrollment deleted successfully")
}

func (srv *Server) handleUpdateProgramClassEnrollments(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("e_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class enrollment ID")
	}
	defer r.Body.Close()
	enrollment := models.ProgramClassEnrollment{}
	if err := json.NewDecoder(r.Body).Decode(&enrollment); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	enrollment.ID = uint(id)
	updated, err := srv.Db.UpdateProgramClassEnrollments(&enrollment)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, updated)
}

func (srv *Server) handleGetProgramClassEnrollmentsAttendance(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class enrollment ID")
	}
	log.add("class_enrollment_id", id)
	page, perPage := srv.getPaginationInfo(r)
	total, attendance, err := srv.Db.GetProgramClassEnrollmentsAttendance(page, perPage, id)
	if err != nil {
		log.add("classEnrollmentId", id)
		return newDatabaseServiceError(err)
	}
	log.add("total", total)
	log.info("class enrollment attendance fetched")
	paginationData := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, attendance, paginationData)
}
