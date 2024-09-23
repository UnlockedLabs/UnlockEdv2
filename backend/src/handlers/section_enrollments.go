package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerProgramSectionEnrollmentssRoutes() {
	srv.Mux.Handle("GET /api/section-enrollments", srv.applyMiddleware(srv.handleIndexProgramSectionEnrollments))
	srv.Mux.Handle("GET /api/section-enrollments/{id}", srv.applyMiddleware(srv.handleGetProgramSectionEnrollments))
	srv.Mux.Handle("GET /api/programs/{id}/sections/enrollments", srv.applyMiddleware(srv.handleGetEnrollmentsForProgram))
	srv.Mux.Handle("POST /api/section-enrollments/{section_id}/enroll/{user_id}", srv.applyAdminMiddleware(srv.handleEnrollUser))
	srv.Mux.Handle("DELETE /api/section-enrollments/{id}", srv.applyAdminMiddleware(srv.handleDeleteProgramSectionEnrollments))
	srv.Mux.Handle("PATCH /api/section-enrollments/{id}", srv.applyAdminMiddleware(srv.handleUpdateProgramSectionEnrollments))
	srv.Mux.Handle("GET /api/section-enrollments/{id}/attendance", srv.applyAdminMiddleware(srv.handleGetProgramSectionEnrollmentsAttendance))
	srv.Mux.Handle("GET /api/users/{id}/section-enrollments", srv.applyMiddleware(srv.handleGetUserEnrollments))
}

/* this gets all enrollments for an entire facility.. may rarely be called */
func (srv *Server) handleIndexProgramSectionEnrollments(w http.ResponseWriter, r *http.Request, log sLog) error {
	facilityID := r.Context().Value(ClaimsKey).(*Claims).FacilityID
	log.add("facility_id", facilityID)
	page, perPage := srv.getPaginationInfo(r)
	total, enrollemnts, err := srv.Db.GetProgramSectionEnrollmentsForFacility(page, perPage, facilityID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	paginationData := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, enrollemnts, paginationData)
}

func (srv *Server) handleGetProgramSectionEnrollments(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "section enrollment ID")
	}
	log.add("section_enrollment_id", id)
	enrollment, err := srv.Db.GetProgramSectionEnrollmentsByID(id)
	if err != nil {
		log.add("sectionEnrollmentId", id)
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, enrollment)
}

func (srv *Server) handleGetUserEnrollments(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	page, perPage := srv.getPaginationInfo(r)
	if !srv.canViewUserData(r) {
		return newUnauthorizedServiceError()
	}
	total, enrollemnts, err := srv.Db.GetProgramSectionEnrollmentsForUser(id, page, perPage)
	if err != nil {
		log.add("userId", id)
		return newDatabaseServiceError(err)
	}
	paginationData := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, enrollemnts, paginationData)
}

func (srv *Server) handleGetEnrollmentsForProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	facilityID := r.Context().Value(ClaimsKey).(*Claims).FacilityID
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	log.add("program_id", id)
	page, perPage := srv.getPaginationInfo(r)
	total, enrollemnts, err := srv.Db.GetProgramSectionEnrollmentssForProgram(page, perPage, int(facilityID), id)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	paginationData := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, enrollemnts, paginationData)
}

func (srv *Server) handleEnrollUser(w http.ResponseWriter, r *http.Request, log sLog) error {
	sectionID, err := strconv.Atoi(r.PathValue("section_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "section ID")
	}
	log.add("section_id", sectionID)
	userID, err := strconv.Atoi(r.PathValue("user_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "user ID")
	}
	log.add("user_id", userID)
	log.info("enrolling user")
	err = srv.Db.CreateProgramSectionEnrollments(sectionID, userID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, "user enrolled")
}

func (srv *Server) handleDeleteProgramSectionEnrollments(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program section enrollment ID")
	}
	log.add("section_enrollment_id", id)
	err = srv.Db.DeleteProgramSectionEnrollments(id)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	log.info("section enrollment deleted")
	return writeJsonResponse(w, http.StatusNoContent, "Section enrollment deleted successfully")
}

func (srv *Server) handleUpdateProgramSectionEnrollments(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "section enrollment ID")
	}
	defer r.Body.Close()
	enrollment := models.ProgramSectionEnrollment{}
	if err := json.NewDecoder(r.Body).Decode(&enrollment); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	enrollment.ID = uint(id)
	updated, err := srv.Db.UpdateProgramSectionEnrollments(&enrollment)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, updated)
}

func (srv *Server) handleGetProgramSectionEnrollmentsAttendance(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "section enrollment ID")
	}
	log.add("section_enrollment_id", id)
	page, perPage := srv.getPaginationInfo(r)
	total, attendance, err := srv.Db.GetProgramSectionEnrollmentsAttendance(page, perPage, id)
	if err != nil {
		log.add("sectionEnrollmentId", id)
		return newDatabaseServiceError(err)
	}
	log.add("total", total)
	log.info("section enrollment attendance fetched")
	paginationData := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, attendance, paginationData)
}
