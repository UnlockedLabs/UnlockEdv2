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
		{"GET /api/class-enrollments", srv.handleIndexProgramClassEnrollments, true, axx},
		{"GET /api/class-enrollments/{id}", srv.handleGetProgramClassEnrollments, false, axx},
		{"GET /api/programs/{id}/classes/enrollments", srv.handleGetEnrollmentsForProgram, false, axx},
		{"POST /api/class-enrollments/{class_id}/enroll/{user_id}", srv.handleEnrollUser, false, axx},
		{"DELETE /api/class-enrollments/{id}", srv.handleDeleteProgramClassEnrollments, true, axx},
		{"PATCH /api/class-enrollments/{id}", srv.handleUpdateProgramClassEnrollments, true, axx},
		{"GET /api/class-enrollments/{id}/attendance", srv.handleGetProgramClassEnrollmentsAttendance, true, axx},
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
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class enrollment ID")
	}
	log.add("class_enrollment_id", id)
	enrollment, err := srv.Db.GetProgramClassEnrollmentsByID(id)
	if err != nil {
		log.add("classEnrollmentId", id)
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

func (srv *Server) handleGetEnrollmentsForProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	log.add("program_id", id)
	args := srv.getQueryContext(r)
	enrollemnts, err := srv.Db.GetProgramClassEnrollmentsForProgram(&args, id)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writePaginatedResponse(w, http.StatusOK, enrollemnts, args.IntoMeta())
}

func (srv *Server) handleEnrollUser(w http.ResponseWriter, r *http.Request, log sLog) error {
	classID, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	log.add("class_id", classID)

	// the id of the credentialed user being enrolled
	userID, err := strconv.Atoi(r.PathValue("user_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	log.add("user_id", userID)
	log.info("enrolling user")
	err = srv.Db.CreateProgramClassEnrollments(classID, userID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, "user enrolled")
}

func (srv *Server) handleDeleteProgramClassEnrollments(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
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
	id, err := strconv.Atoi(r.PathValue("id"))
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
