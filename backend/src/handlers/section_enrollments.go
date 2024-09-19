package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strconv"
)

func (srv *Server) registerSectionEnrollmentsRoutes() {
	srv.Mux.Handle("GET /api/section-enrollments", srv.applyMiddleware(srv.handleIndexSectionEnrollments))
	srv.Mux.Handle("GET /api/section-enrollments/{id}", srv.applyMiddleware(srv.handleGetSectionEnrollment))
	srv.Mux.Handle("GET /api/programs/{id}/sections/{section_id}/enrollments", srv.applyMiddleware(srv.handleGetEnrollmentsForProgram))
	srv.Mux.Handle("POST /api/section-enrollments/{id}/enroll/{user_id}", srv.applyAdminMiddleware(srv.handleEnrollUser))
	srv.Mux.Handle("DELETE /api/section-enrollments/{id}", srv.applyAdminMiddleware(srv.handleDeleteSectionEnrollment))
	srv.Mux.Handle("PATCH /api/section-enrollments/{id}", srv.applyAdminMiddleware(srv.handleUpdateSectionEnrollment))
	srv.Mux.Handle("GET /api/section-enrollments/{id}/attendance", srv.applyAdminMiddleware(srv.handleGetSectionEnrollmentAttendance))
	srv.Mux.Handle("GET /api/users/{id}/section-enrollments", srv.applyMiddleware(srv.handleGetUserEnrollments))
}

/* this gets all enrollments for an entire facility.. may rarely be called */
func (srv *Server) handleIndexSectionEnrollments(w http.ResponseWriter, r *http.Request, log sLog) error {
	facilityID := r.Context().Value(ClaimsKey).(*Claims).FacilityID
	log.add("facility_id", facilityID)
	page, perPage := srv.getPaginationInfo(r)
	total, enrollemnts, err := srv.Db.GetSectionEnrollmentsForFacility(page, perPage, facilityID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	paginationData := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, enrollemnts, paginationData)
}

func (srv *Server) handleGetSectionEnrollment(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "section enrollment ID")
	}
	log.add("section_enrollment_id", id)
	enrollment, err := srv.Db.GetSectionEnrollmentByID(id)
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
	total, enrollemnts, err := srv.Db.GetSectionEnrollmentsForUser(id, page, perPage)
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
	total, enrollemnts, err := srv.Db.GetSectionEnrollmentsForProgram(page, perPage, int(facilityID), id)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	paginationData := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, enrollemnts, paginationData)
}

func (srv *Server) handleEnrollUser(w http.ResponseWriter, r *http.Request, log sLog) error {
	programID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	log.add("program_id", programID)
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
	err = srv.Db.CreateSectionEnrollment(sectionID, userID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusCreated, "user enrolled")
}

func (srv *Server) handleDeleteSectionEnrollment(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "section enrollment ID")
	}
	log.add("section_enrollment_id", id)
	err = srv.Db.DeleteSectionEnrollment(id)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	log.info("section enrollment deleted")
	return writeJsonResponse(w, http.StatusOK, "Section enrollment deleted successfully")
}

func (srv *Server) handleUpdateSectionEnrollment(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "section enrollment ID")
	}
	defer r.Body.Close()
	enrollment := models.SectionEnrollment{}
	if err := json.NewDecoder(r.Body).Decode(&enrollment); err != nil {
		return newJSONReqBodyServiceError(err)
	}
	enrollment.ID = uint(id)
	updated, err := srv.Db.UpdateSectionEnrollment(&enrollment)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	return writeJsonResponse(w, http.StatusOK, updated)
}

func (srv *Server) handleGetSectionEnrollmentAttendance(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "section enrollment ID")
	}
	log.add("section_enrollment_id", id)
	page, perPage := srv.getPaginationInfo(r)
	total, attendance, err := srv.Db.GetSectionEnrollmentAttendance(page, perPage, id)
	if err != nil {
		log.add("sectionEnrollmentId", id)
		return newDatabaseServiceError(err)
	}
	log.add("total", total)
	log.info("section enrollment attendance fetched")
	paginationData := models.NewPaginationInfo(page, perPage, total)
	return writePaginatedResponse(w, http.StatusOK, attendance, paginationData)
}
